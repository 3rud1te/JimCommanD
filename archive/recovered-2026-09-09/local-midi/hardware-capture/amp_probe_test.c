// Offline checks only: no CoreMIDI client is created and nothing is transmitted.
#define main mosaic_live_main
#include "amp_slot_probe.c"
#undef main
#include <assert.h>

static void feed(const unsigned char *data, size_t length) {
    MIDIPacketList packets;
    MIDIPacket *packet = MIDIPacketListInit(&packets);
    assert(MIDIPacketListAdd(&packets, sizeof(packets), packet, 0, length, data));
    receive(&packets, NULL, NULL);
}

int main(void) {
    unsigned char request[64];
    const unsigned char expected[] = {0xF0,0x7D,0x4E,0x43,0x70,0,2,1,0,0x36,0,1,0,0,1,0xF7};
    assert(make_request(1, 1, request) == sizeof(expected));
    assert(!memcmp(request, expected, sizeof(expected)));
    for (unsigned slot = 0; slot < 30; ++slot) {
        unsigned char inner[32];
        size_t n = make_request(slot, slot + 1, request);
        assert(unpack7(request + 5, n - 6, inner) == 8);
        assert(inner[1] == slot + 1 && inner[5] == 1 && inner[6] == 0 && inner[7] == slot);
    }
    const unsigned char capture[] = {
        0xF0,0x7D,0x4E,0x43,0x71,0,2,1,0,0x36,0,0,0x1E,0x10,0,1,1,0,0x52,0x2F,0,
        8,0,0x64,0x5F,0x3C,0x44,0x1A,0x1A,0,0,0x42,0x6F,0x67,0x58,0x54,0x43,
        0,0x32,0,0,0,0,0,0,0,0,0,0,0xF7
    };
    assert(sizeof(capture) == 50);
    expected_slot = 1; expected_sequence = 1;
    feed(capture, 48);
    assert(!response_received);
    const unsigned char clock_byte = 0xF8;
    feed(&clock_byte, 1);
    feed(capture + 48, 2);
    assert(response_received && response_status == 0 && !strcmp(response_name, "BogXTC2"));
    response_received = 0; expected_slot = 2;
    feed(capture, sizeof(capture));
    assert(!response_received); // Reply for a different slot cannot complete a query.
    expected_slot = 1; expected_sequence = 2;
    feed(capture, sizeof(capture));
    assert(!response_received); // Late reply cannot complete the next transaction.
    expected_sequence = 1;
    const unsigned char error[] = {0xF0,0x7D,0x4E,0x43,0x71,0,2,1,0,0x36,0,1,0,0,0,0xF7};
    feed(error, sizeof(error));
    assert(response_received && response_status == 1);
    puts("Offline inventory checks passed.");
    return 0;
}
