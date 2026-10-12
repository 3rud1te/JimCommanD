#include <CoreFoundation/CoreFoundation.h>
#include <CoreMIDI/CoreMIDI.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <pthread.h>

static unsigned char assembled[4096];
static size_t assembled_length;
static int collecting;
static pthread_mutex_t response_lock = PTHREAD_MUTEX_INITIALIZER;
static unsigned expected_sequence, expected_slot;
static int response_received, response_status;
static char response_name[17];

static size_t make_request(unsigned slot, unsigned sequence, unsigned char *sysex) {
    const unsigned char inner[] = {0x02, sequence & 0xFF, sequence >> 8,
                                   0x36, 0x00, 0x01, 0x00, slot};
    memcpy(sysex, "\xF0\x7D\x4E\x43\x70", 5);
    // Encode this fixed eight-byte query as two seven-bit groups (slot 0..29).
    sysex[5] = 0;
    for (unsigned i = 0; i < 7; ++i) {
        if (inner[i] & 0x80) sysex[5] |= 1 << i;
        sysex[6 + i] = inner[i] & 0x7F;
    }
    sysex[13] = 0;
    sysex[14] = inner[7];
    sysex[15] = 0xF7;
    return 16;
}

static void name_of(MIDIObjectRef object, char *buffer, size_t length) {
    CFStringRef value = NULL;
    buffer[0] = 0;
    if (MIDIObjectGetStringProperty(object, kMIDIPropertyDisplayName, &value) == noErr && value) {
        CFStringGetCString(value, buffer, length, kCFStringEncodingUTF8);
        CFRelease(value);
    }
}

static size_t unpack7(const unsigned char *input, size_t length, unsigned char *output) {
    size_t in = 0, out = 0;
    while (in < length) {
        unsigned char msb = input[in++];
        for (unsigned bit = 0; bit < 7 && in < length; ++bit, ++in)
            output[out++] = input[in] | (((msb >> bit) & 1) << 7);
    }
    return out;
}

static void decode_response(void) {
    if (assembled_length < 7 || memcmp(assembled, "\xF0\x7D\x4E\x43\x71", 5)) return;
    unsigned char inner[4096];
    size_t inner_length = unpack7(assembled + 5, assembled_length - 6, inner);
    printf("Decoded (%zu bytes): ", inner_length);
    for (size_t i = 0; i < inner_length; ++i) printf("%02X%s", inner[i], i + 1 == inner_length ? "" : " ");
    printf("\n");
    if (inner_length < 8) return;
    unsigned sequence = inner[1] | (inner[2] << 8);
    unsigned opcode = inner[3] | (inner[4] << 8);
    unsigned status = inner[5];
    unsigned payload_length = inner[6] | (inner[7] << 8);
    if (inner[0] != 2 || inner_length != payload_length + 8) return;
    printf("sequence=%u opcode=0x%02X status=%u payloadLength=%u\n",
           sequence, opcode, status, payload_length);
    if (status) printf("Device status: %s\n", status == 1 ? "bad payload" : "nonzero (meaning not decoded)");
    if (sequence != expected_sequence || opcode != 0x36 || response_received) return;
    if (status != 0) { response_status = (int)status; response_received = 1; return; }
    if (status == 0 && opcode == 0x36 && payload_length >= 30 && inner_length == payload_length + 8) {
        const unsigned char *payload = inner + 8;
        printf("returned wire slot: %u\n", payload[0]);
        printf("metadata: ");
        for (size_t i = 0; i < 14; ++i) printf("%02X%s", payload[i], i == 13 ? "" : " ");
        printf("\nmodel: %.*s\n", 16, payload + 14);
        if (payload[0] == expected_slot) {
            memcpy(response_name, payload + 14, 16);
            response_name[16] = '\0';
            response_status = 0;
            response_received = 1;
        }
    }
}

static void receive(const MIDIPacketList *list, void *read_ref, void *source_ref) {
    (void)read_ref;
    (void)source_ref;
    pthread_mutex_lock(&response_lock);
    const MIDIPacket *packet = &list->packet[0];
    for (UInt32 i = 0; i < list->numPackets; ++i) {
        printf("RX (%u bytes): ", packet->length);
        for (UInt16 j = 0; j < packet->length; ++j) {
            unsigned char byte = packet->data[j];
            printf("%02X ", byte);
            if (byte >= 0xF8) continue; // Interleaved MIDI realtime bytes.
            if (byte == 0xF0) { assembled_length = 0; collecting = 1; }
            if (!collecting) continue;
            if (byte >= 0x80 && byte != 0xF0 && byte != 0xF7) { collecting = 0; continue; }
            if (assembled_length >= sizeof(assembled)) { collecting = 0; continue; }
            assembled[assembled_length++] = byte;
            if (byte == 0xF7) { printf("\n"); decode_response(); collecting = 0; }
        }
        printf("\n");
        packet = MIDIPacketNext(packet);
    }
    fflush(stdout);
    pthread_mutex_unlock(&response_lock);
}

int main(int argc, char **argv) {
    char *end = NULL;
    errno = 0;
    int all = argc > 1 && !strcmp(argv[1], "--all");
    long slot = argc > 1 && !all ? strtol(argv[1], &end, 10) : 0;
    int dry_run = argc == 3 && !strcmp(argv[2], "--dry-run");
    if (argc > 3 || (argc == 3 && !dry_run) || errno ||
        (argc > 1 && !all && (end == argv[1] || *end)) || slot < 0 || slot > 29) {
        fprintf(stderr, "Usage: %s [wire-slot 0-29 | --all] [--dry-run]\n", argv[0]);
        return 1;
    }

    unsigned first = all ? 0 : (unsigned)slot, last = all ? 29 : (unsigned)slot;
    printf("AMP probe v3; read-only slot-info %u..%u\n", first, last);
    if (dry_run) {
        for (unsigned current = first; current <= last; ++current) {
            unsigned char sysex[64];
            size_t length = make_request(current, current - first + 1, sysex);
            printf("DRY-RUN slot %u: ", current);
            for (size_t i = 0; i < length; ++i) printf("%02X ", sysex[i]);
            printf("\n");
        }
        return 0;
    }

    MIDIClientRef client = 0;
    MIDIPortRef input = 0, output = 0;
    MIDIEndpointRef source = 0, destination = 0;
    OSStatus status = MIDIClientCreate(CFSTR("Mosaic AMP Slot Probe"), NULL, NULL, &client);
    if (status != noErr) {
        fprintf(stderr, "MIDIClientCreate failed: %d. NOTHING SENT.\n", (int)status);
        return 2;
    }
    status = MIDIInputPortCreate(client, CFSTR("Mosaic Input"), receive, NULL, &input);
    if (status == noErr) status = MIDIOutputPortCreate(client, CFSTR("Mosaic Output"), &output);
    if (status != noErr) {
        fprintf(stderr, "MIDI port creation failed: %d. NOTHING SENT.\n", (int)status);
        return 2;
    }

    for (ItemCount i = 0; i < MIDIGetNumberOfSources(); ++i) {
        MIDIEndpointRef endpoint = MIDIGetSource(i);
        char name[256]; name_of(endpoint, name, sizeof(name));
        if (!strcmp(name, "Mosaic")) source = endpoint;
    }
    for (ItemCount i = 0; i < MIDIGetNumberOfDestinations(); ++i) {
        MIDIEndpointRef endpoint = MIDIGetDestination(i);
        char name[256]; name_of(endpoint, name, sizeof(name));
        if (!strcmp(name, "Mosaic")) destination = endpoint;
    }
    if (!source || !destination) {
        printf("Exact USB endpoint 'Mosaic' not found. NOTHING SENT.\n");
        return 2;
    }
    status = MIDIPortConnectSource(input, source, NULL);
    if (status != noErr) {
        fprintf(stderr, "MIDI input connection failed: %d. NOTHING SENT.\n", (int)status);
        return 2;
    }

    char names[30][17] = {{0}};
    int results[30];
    for (unsigned i = 0; i < 30; ++i) results[i] = -1;
    int failed = 0;
    for (unsigned current = first; current <= last; ++current) {
        unsigned sequence = current - first + 1;
        unsigned char sysex[64];
        size_t sysex_length = make_request(current, sequence, sysex);
        pthread_mutex_lock(&response_lock);
        expected_slot = current;
        expected_sequence = sequence;
        response_received = 0;
        response_status = -1;
        response_name[0] = '\0';
        pthread_mutex_unlock(&response_lock);

        MIDIPacketList packets;
        MIDIPacket *packet = MIDIPacketListInit(&packets);
        packet = MIDIPacketListAdd(&packets, sizeof(packets), packet, 0, sysex_length, sysex);
        printf("\nQuerying AMP wire slot %u (UI slot %u)\nTX: ", current, current + 1);
        for (size_t i = 0; i < sysex_length; ++i) printf("%02X ", sysex[i]);
        printf("\n");
        fflush(stdout);
        status = packet ? MIDISend(output, destination, &packets) : -1;
        if (status != noErr) { printf("MIDISend error: %d\n", (int)status); failed = 1; break; }

        CFAbsoluteTime deadline = CFAbsoluteTimeGetCurrent() + 5.0;
        int done = 0;
        do {
            CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.10, false);
            pthread_mutex_lock(&response_lock);
            done = response_received;
            if (done) {
                results[current] = response_status;
                memcpy(names[current], response_name, 17);
            }
            pthread_mutex_unlock(&response_lock);
        } while (!done && CFAbsoluteTimeGetCurrent() < deadline);
        if (!done || results[current] != 0) failed = 1;
        if (!done) { printf("No matching reply within 5 seconds; stopping inventory.\n"); break; }
        // Bad payload / unsupported commands need investigation, not repetition.
        if (results[current] != 0) { printf("Device error; stopping inventory.\n"); break; }
    }
    printf("\nAMP INVENTORY (UI slot / wire index / result)\n");
    for (unsigned current = first; current <= last; ++current) {
        printf("%02u / %02u / ", current + 1, current);
        if (results[current] == 0) printf("%s\n", names[current][0] ? names[current] : "[blank name; see metadata]");
        else if (results[current] > 0) printf("device status %d\n", results[current]);
        else printf("unconfirmed\n");
    }
    printf("Done.\n");
    MIDIPortDispose(input);
    MIDIPortDispose(output);
    MIDIClientDispose(client);
    return failed ? 3 : 0;
}
