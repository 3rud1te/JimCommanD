#include <CoreFoundation/CoreFoundation.h>
#include <CoreMIDI/CoreMIDI.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static char *object_string(MIDIObjectRef object, CFStringRef property,
                           char *buffer, size_t length) {
    CFStringRef value = NULL;
    if (MIDIObjectGetStringProperty(object, property, &value) != noErr || !value) {
        snprintf(buffer, length, "<unset>");
        return buffer;
    }
    if (!CFStringGetCString(value, buffer, length, kCFStringEncodingUTF8)) {
        snprintf(buffer, length, "<unprintable>");
    }
    CFRelease(value);
    return buffer;
}

static SInt32 object_int(MIDIObjectRef object, CFStringRef property) {
    SInt32 value = -1;
    MIDIObjectGetIntegerProperty(object, property, &value);
    return value;
}

static int is_mosaic(MIDIObjectRef object) {
    char name[256], display[256], manufacturer[256], model[256];
    object_string(object, kMIDIPropertyName, name, sizeof(name));
    object_string(object, kMIDIPropertyDisplayName, display, sizeof(display));
    object_string(object, kMIDIPropertyManufacturer, manufacturer, sizeof(manufacturer));
    object_string(object, kMIDIPropertyModel, model, sizeof(model));
    return strcasestr(name, "mosaic") || strcasestr(display, "mosaic") ||
           strcasestr(manufacturer, "ember") || strcasestr(model, "mosaic");
}

static void print_object(const char *kind, MIDIObjectRef object) {
    char name[256], display[256], manufacturer[256], model[256], driver[256];
    printf("%s ref=%u name=\"%s\" display=\"%s\" manufacturer=\"%s\" model=\"%s\" ",
           kind, object,
           object_string(object, kMIDIPropertyName, name, sizeof(name)),
           object_string(object, kMIDIPropertyDisplayName, display, sizeof(display)),
           object_string(object, kMIDIPropertyManufacturer, manufacturer, sizeof(manufacturer)),
           object_string(object, kMIDIPropertyModel, model, sizeof(model)));
    printf("uniqueID=%d deviceID=%d offline=%d private=%d driverOwner=\"%s\"\n",
           object_int(object, kMIDIPropertyUniqueID),
           object_int(object, kMIDIPropertyDeviceID),
           object_int(object, kMIDIPropertyOffline),
           object_int(object, kMIDIPropertyPrivate),
           object_string(object, kMIDIPropertyDriverOwner, driver, sizeof(driver)));
}

static void receive(const MIDIPacketList *list, void *readRefCon, void *srcConnRefCon) {
    const MIDIPacket *packet = &list->packet[0];
    for (UInt32 i = 0; i < list->numPackets; ++i) {
        printf("RX timestamp=%llu length=%u data=", packet->timeStamp, packet->length);
        for (UInt16 j = 0; j < packet->length; ++j) printf("%02X%s", packet->data[j], j + 1 == packet->length ? "" : " ");
        printf("\n");
        packet = MIDIPacketNext(packet);
    }
    fflush(stdout);
}

int main(void) {
    printf("CoreMIDI devices=%lu sources=%lu destinations=%lu\n",
           (unsigned long)MIDIGetNumberOfDevices(),
           (unsigned long)MIDIGetNumberOfSources(),
           (unsigned long)MIDIGetNumberOfDestinations());

    for (ItemCount d = 0; d < MIDIGetNumberOfDevices(); ++d) {
        MIDIDeviceRef device = MIDIGetDevice(d);
        print_object("DEVICE", device);
        for (ItemCount e = 0; e < MIDIDeviceGetNumberOfEntities(device); ++e) {
            MIDIEntityRef entity = MIDIDeviceGetEntity(device, e);
            print_object("  ENTITY", entity);
            for (ItemCount s = 0; s < MIDIEntityGetNumberOfSources(entity); ++s)
                print_object("    SOURCE", MIDIEntityGetSource(entity, s));
            for (ItemCount t = 0; t < MIDIEntityGetNumberOfDestinations(entity); ++t)
                print_object("    DEST", MIDIEntityGetDestination(entity, t));
        }
    }

    MIDIClientRef client = 0;
    MIDIPortRef input = 0, output = 0;
    OSStatus status = MIDIClientCreate(CFSTR("JimCommanD Mosaic Probe"), NULL, NULL, &client);
    printf("MIDIClientCreate=%d\n", status);
    if (status != noErr) return 2;
    status = MIDIInputPortCreate(client, CFSTR("Mosaic Probe Input"), receive, NULL, &input);
    printf("MIDIInputPortCreate=%d\n", status);
    status = MIDIOutputPortCreate(client, CFSTR("Mosaic Probe Output"), &output);
    printf("MIDIOutputPortCreate=%d\n", status);

    int matchedSources = 0, matchedDestinations = 0;
    for (ItemCount i = 0; i < MIDIGetNumberOfSources(); ++i) {
        MIDIEndpointRef source = MIDIGetSource(i);
        if (is_mosaic(source)) {
            print_object("MATCHED SOURCE", source);
            status = MIDIPortConnectSource(input, source, NULL);
            printf("MIDIPortConnectSource=%d\n", status);
            matchedSources++;
        }
    }

    const Byte identityRequest[] = {0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7};
    for (ItemCount i = 0; i < MIDIGetNumberOfDestinations(); ++i) {
        MIDIEndpointRef destination = MIDIGetDestination(i);
        if (!is_mosaic(destination)) continue;
        print_object("MATCHED DEST", destination);
        Byte storage[1024];
        MIDIPacketList *packets = (MIDIPacketList *)storage;
        MIDIPacket *packet = MIDIPacketListInit(packets);
        packet = MIDIPacketListAdd(packets, sizeof(storage), packet, 0,
                                   sizeof(identityRequest), identityRequest);
        status = packet ? MIDISend(output, destination, packets) : -1;
        printf("SEND universal-identity-request [F0 7E 7F 06 01 F7]=%d\n", status);
        matchedDestinations++;
    }
    printf("matchedSources=%d matchedDestinations=%d; listening 5 seconds\n",
           matchedSources, matchedDestinations);
    fflush(stdout);
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, 5.0, false);
    if (input) MIDIPortDispose(input);
    if (output) MIDIPortDispose(output);
    MIDIClientDispose(client);
    return 0;
}
