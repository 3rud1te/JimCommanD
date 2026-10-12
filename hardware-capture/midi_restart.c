#include <CoreMIDI/CoreMIDI.h>
#include <stdio.h>

int main(void)
{
    OSStatus status = MIDIRestart();
    printf("MIDIRestart: %d\n", (int)status);
    return status == noErr ? 0 : 1;
}
