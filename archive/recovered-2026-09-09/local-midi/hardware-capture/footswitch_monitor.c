// Passive CoreMIDI monitor for Mosaic footswitch discovery. Sends no MIDI.
#include <CoreMIDI/CoreMIDI.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int events = 0;

static void print_name(MIDIObjectRef object, char *buffer, size_t size) {
    CFStringRef value = NULL;
    buffer[0] = '\0';
    if (MIDIObjectGetStringProperty(object, kMIDIPropertyDisplayName, &value) != noErr || !value) return;
    CFStringGetCString(value, buffer, size, kCFStringEncodingUTF8);
    CFRelease(value);
}

static void received(const MIDIPacketList *packets, void *context, void *source_context) {
    const MIDIPacket *packet = &packets->packet[0];
    for (UInt32 index = 0; index < packets->numPackets; ++index) {
        printf("RX");
        for (UInt16 byte = 0; byte < packet->length; ++byte) printf(" %02X", packet->data[byte]);
        printf("\n");
        fflush(stdout);
        events++;
        packet = MIDIPacketNext(packet);
    }
}

int main(int argc, char **argv) {
    double seconds = argc > 1 ? strtod(argv[1], NULL) : 20.0;
    if (seconds <= 0 || seconds > 300) seconds = 20.0;
    MIDIClientRef client = 0;
    MIDIPortRef input = 0;
    OSStatus status = MIDIClientCreate(CFSTR("JimCommanD passive monitor"), NULL, NULL, &client);
    if (status == noErr) status = MIDIInputPortCreate(client, CFSTR("Mosaic footswitch input"), received, NULL, &input);
    if (status != noErr) {
        fprintf(stderr, "CoreMIDI unavailable (%d)\n", (int)status);
        return 2;
    }
    int matches = 0;
    for (ItemCount index = 0; index < MIDIGetNumberOfSources(); ++index) {
        MIDIEndpointRef source = MIDIGetSource(index);
        char name[256]; print_name(source, name, sizeof(name));
        if (!strstr(name, "Mosaic") && !strstr(name, "MOSAIC")) continue;
        status = MIDIPortConnectSource(input, source, NULL);
        if (status == noErr) { printf("Listening to: %s\n", name); matches++; }
        else fprintf(stderr, "Could not connect to %s (%d)\n", name, (int)status);
    }
    if (!matches) {
        fprintf(stderr, "No connectable Mosaic MIDI source found.\n");
        MIDIPortDispose(input); MIDIClientDispose(client);
        return 3;
    }
    printf("Passive capture for %.1f seconds; press Mosaic switches A, B and C.\n", seconds);
    fflush(stdout);
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, seconds, false);
    printf("Done; %d MIDI packets received.\n", events);
    MIDIPortDispose(input); MIDIClientDispose(client);
    return 0;
}
