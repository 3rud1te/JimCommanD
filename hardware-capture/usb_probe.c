#include <libusb-1.0/libusb.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MOSAIC_VID 0x33C3
#define MOSAIC_PID 0x1302

static void dump_hex(const unsigned char *p, int n) {
    for (int i = 0; i < n; ++i) printf("%02X%s", p[i], i + 1 == n ? "" : " ");
}

static void print_extra(const char *label, const unsigned char *extra, int length) {
    printf("      %s extraLength=%d", label, length);
    if (length > 0) {
        printf(" bytes=");
        dump_hex(extra, length);
    }
    printf("\n");
}

static void print_string(libusb_device_handle *handle, const char *label, uint8_t index) {
    unsigned char value[256] = {0};
    if (!index) {
        printf("%s=<none>\n", label);
        return;
    }
    int rc = libusb_get_string_descriptor_ascii(handle, index, value, sizeof(value));
    printf("%s(index=%u) rc=%d value=\"%s\"\n", label, index, rc,
           rc > 0 ? (char *)value : libusb_error_name(rc));
}

static int dump_device(libusb_device *device, struct libusb_device_descriptor *dd) {
    printf("DEVICE bus=%u address=%u speed=%d vid=%04X pid=%04X class=%u subclass=%u protocol=%u usb=%04X device=%04X configs=%u\n",
           libusb_get_bus_number(device), libusb_get_device_address(device), libusb_get_device_speed(device),
           dd->idVendor, dd->idProduct, dd->bDeviceClass, dd->bDeviceSubClass, dd->bDeviceProtocol,
           dd->bcdUSB, dd->bcdDevice, dd->bNumConfigurations);

    for (uint8_t ci = 0; ci < dd->bNumConfigurations; ++ci) {
        struct libusb_config_descriptor *config = NULL;
        int rc = libusb_get_config_descriptor(device, ci, &config);
        if (rc < 0) {
            printf("  CONFIG[%u] error=%s\n", ci, libusb_error_name(rc));
            continue;
        }
        printf("  CONFIG[%u] value=%u interfaces=%u attributes=0x%02X maxPower=%umA totalLength=%u\n",
               ci, config->bConfigurationValue, config->bNumInterfaces, config->bmAttributes,
               config->MaxPower * 2, config->wTotalLength);
        print_extra("config", config->extra, config->extra_length);
        for (uint8_t ii = 0; ii < config->bNumInterfaces; ++ii) {
            const struct libusb_interface *iface = &config->interface[ii];
            for (int ai = 0; ai < iface->num_altsetting; ++ai) {
                const struct libusb_interface_descriptor *alt = &iface->altsetting[ai];
                printf("    INTERFACE number=%u alt=%u class=%u subclass=%u protocol=%u endpoints=%u iInterface=%u\n",
                       alt->bInterfaceNumber, alt->bAlternateSetting, alt->bInterfaceClass,
                       alt->bInterfaceSubClass, alt->bInterfaceProtocol, alt->bNumEndpoints,
                       alt->iInterface);
                print_extra("interface", alt->extra, alt->extra_length);
                for (uint8_t ei = 0; ei < alt->bNumEndpoints; ++ei) {
                    const struct libusb_endpoint_descriptor *ep = &alt->endpoint[ei];
                    printf("      ENDPOINT address=0x%02X direction=%s transferType=%u maxPacket=%u interval=%u sync=0x%02X refresh=%u\n",
                           ep->bEndpointAddress,
                           (ep->bEndpointAddress & LIBUSB_ENDPOINT_IN) ? "IN" : "OUT",
                           ep->bmAttributes & LIBUSB_TRANSFER_TYPE_MASK,
                           ep->wMaxPacketSize, ep->bInterval, ep->bSynchAddress, ep->bRefresh);
                    print_extra("endpoint", ep->extra, ep->extra_length);
                }
            }
        }
        libusb_free_config_descriptor(config);
    }
    return 0;
}

int main(void) {
    libusb_context *context = NULL;
    libusb_device **devices = NULL;
    int rc = libusb_init(&context);
    if (rc < 0) {
        printf("libusb_init error=%s\n", libusb_error_name(rc));
        return 2;
    }
    ssize_t count = libusb_get_device_list(context, &devices);
    printf("libusb devices=%zd\n", count);
    libusb_device *target = NULL;
    struct libusb_device_descriptor targetDescriptor = {0};
    for (ssize_t i = 0; i < count; ++i) {
        struct libusb_device_descriptor dd;
        if (libusb_get_device_descriptor(devices[i], &dd) < 0) continue;
        if (dd.idVendor == MOSAIC_VID && dd.idProduct == MOSAIC_PID) {
            target = libusb_ref_device(devices[i]);
            targetDescriptor = dd;
            dump_device(target, &targetDescriptor);
        }
    }
    libusb_free_device_list(devices, 1);
    if (!target) {
        printf("TARGET not found\n");
        libusb_exit(context);
        return 3;
    }

    libusb_device_handle *handle = NULL;
    rc = libusb_open(target, &handle);
    printf("OPEN rc=%d (%s)\n", rc, libusb_error_name(rc));
    if (rc < 0) {
        libusb_unref_device(target);
        libusb_exit(context);
        return 4;
    }
    print_string(handle, "MANUFACTURER", targetDescriptor.iManufacturer);
    print_string(handle, "PRODUCT", targetDescriptor.iProduct);
    print_string(handle, "SERIAL", targetDescriptor.iSerialNumber);
    int configuration = -1;
    rc = libusb_get_configuration(handle, &configuration);
    printf("GET_CONFIGURATION rc=%d value=%d\n", rc, configuration);

    const int midiInterface = 4;
    rc = libusb_claim_interface(handle, midiInterface);
    printf("CLAIM interface=%d rc=%d (%s)\n", midiInterface, rc, libusb_error_name(rc));
    if (rc == 0) {
        const unsigned char identityUSBMIDI[] = {
            0x04, 0xF0, 0x7E, 0x7F,
            0x07, 0x06, 0x01, 0xF7
        };
        int transferred = 0;
        rc = libusb_bulk_transfer(handle, 0x01, (unsigned char *)identityUSBMIDI,
                                  sizeof(identityUSBMIDI), &transferred, 1000);
        printf("SEND endpoint=0x01 standard-identity-request rc=%d (%s) transferred=%d data=",
               rc, libusb_error_name(rc), transferred);
        dump_hex(identityUSBMIDI, sizeof(identityUSBMIDI));
        printf("\n");

        unsigned char incoming[512];
        int total = 0;
        for (int attempt = 0; attempt < 10; ++attempt) {
            transferred = 0;
            rc = libusb_bulk_transfer(handle, 0x81, incoming, sizeof(incoming), &transferred, 500);
            if (rc == 0 && transferred > 0) {
                printf("RECEIVE endpoint=0x81 attempt=%d bytes=%d data=", attempt + 1, transferred);
                dump_hex(incoming, transferred);
                printf("\n");
                total += transferred;
            } else if (rc != LIBUSB_ERROR_TIMEOUT) {
                printf("RECEIVE endpoint=0x81 attempt=%d rc=%d (%s) bytes=%d\n",
                       attempt + 1, rc, libusb_error_name(rc), transferred);
            }
        }
        printf("RECEIVE totalBytes=%d\n", total);
        int release = libusb_release_interface(handle, midiInterface);
        printf("RELEASE interface=%d rc=%d (%s)\n", midiInterface, release, libusb_error_name(release));
    }

    libusb_close(handle);
    libusb_unref_device(target);
    libusb_exit(context);
    return rc == 0 ? 0 : 5;
}
