// Receive-only CoreMIDI capture. No MIDI sends, output ports or settings writes.
#include <CoreMIDI/CoreMIDI.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <time.h>
#include <unistd.h>
#include <stdatomic.h>

static FILE *capture;
static atomic_ulong packets;
static void stamp(void) {
    struct timespec now; struct tm utc; char text[40];
    clock_gettime(CLOCK_REALTIME, &now); gmtime_r(&now.tv_sec, &utc);
    strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%S", &utc);
    fprintf(capture, "%s.%03ldZ ", text, now.tv_nsec / 1000000);
}
static void prop(MIDIObjectRef obj, CFStringRef key, char *buf, size_t len) {
    CFStringRef s = NULL; snprintf(buf, len, "<unset>");
    if (MIDIObjectGetStringProperty(obj, key, &s) == noErr && s) {
        CFStringGetCString(s, buf, len, kCFStringEncodingUTF8); CFRelease(s);
    }
}
static void endpoint(const char *kind, MIDIEndpointRef ep) {
    char name[512], display[512], manufacturer[512], model[512]; SInt32 uid=0, offline=-1;
    prop(ep,kMIDIPropertyName,name,sizeof(name)); prop(ep,kMIDIPropertyDisplayName,display,sizeof(display));
    prop(ep,kMIDIPropertyManufacturer,manufacturer,sizeof(manufacturer)); prop(ep,kMIDIPropertyModel,model,sizeof(model));
    MIDIObjectGetIntegerProperty(ep,kMIDIPropertyUniqueID,&uid); MIDIObjectGetIntegerProperty(ep,kMIDIPropertyOffline,&offline);
    stamp(); fprintf(capture,"%s ref=%u uid=%d offline=%d name=\"%s\" display=\"%s\" manufacturer=\"%s\" model=\"%s\"\n",kind,ep,uid,offline,name,display,manufacturer,model);
}
static void receive(const MIDIPacketList *list, void *ctx, void *source) {
    (void)ctx; const MIDIPacket *p=&list->packet[0];
    for (UInt32 i=0;i<list->numPackets;i++) {
        flockfile(capture); stamp();
        fprintf(capture,"RX source_ref=%u host_ticks=%llu length=%u hex=",(unsigned)(uintptr_t)source,(unsigned long long)p->timeStamp,p->length);
        for (UInt16 j=0;j<p->length;j++) fprintf(capture,"%02X%s",p->data[j],j+1==p->length?"":" ");
        fputc('\n',capture); fflush(capture); funlockfile(capture);
        atomic_fetch_add(&packets,1); p=MIDIPacketNext(p);
    }
}
int main(int argc,char **argv) {
    if(argc!=2) { fprintf(stderr,"Usage: %s NEW_LOG_PATH\n",argv[0]); return 1; }
    capture=fopen(argv[1],"wx"); if(!capture) { perror("create exclusive capture log");return 1; }
    setvbuf(capture,NULL,_IOLBF,0); stamp(); fprintf(capture,"START pid=%d receive_only=1 duration_seconds=3600\n",getpid());
    MIDIClientRef client=0; MIDIPortRef input=0;
    OSStatus status=MIDIClientCreate(CFSTR("JimCommanD timestamped passive capture"),NULL,NULL,&client);
    stamp(); fprintf(capture,"MIDIClientCreate status=%d\n",(int)status);
    if(status!=noErr) { fclose(capture);return 2; }
    ItemCount sources=MIDIGetNumberOfSources(), dests=MIDIGetNumberOfDestinations();
    stamp(); fprintf(capture,"ENDPOINT_COUNTS sources=%lu destinations=%lu\n",(unsigned long)sources,(unsigned long)dests);
    for(ItemCount i=0;i<sources;i++) endpoint("SOURCE",MIDIGetSource(i));
    for(ItemCount i=0;i<dests;i++) endpoint("DESTINATION",MIDIGetDestination(i));
    status=MIDIInputPortCreate(client,CFSTR("Mosaic passive input"),receive,NULL,&input);
    stamp(); fprintf(capture,"MIDIInputPortCreate status=%d\n",(int)status);
    if(status!=noErr) { MIDIClientDispose(client);fclose(capture);return 2; }
    int connected=0;
    for(ItemCount i=0;i<sources;i++) {
        MIDIEndpointRef source=MIDIGetSource(i); char name[512],display[512];
        prop(source,kMIDIPropertyName,name,sizeof(name)); prop(source,kMIDIPropertyDisplayName,display,sizeof(display));
        if(!strcasestr(name,"mosaic")&&!strcasestr(display,"mosaic")) continue;
        status=MIDIPortConnectSource(input,source,(void *)(uintptr_t)source);
        stamp(); fprintf(capture,"CONNECT source_ref=%u status=%d\n",source,(int)status);
        if(status==noErr) connected++;
    }
    stamp(); fprintf(capture,"LISTENING connected_sources=%d\n",connected);
    if(connected) for(int i=0;i<3600;i++) {
        CFRunLoopRunInMode(kCFRunLoopDefaultMode,1.0,false);
        if(i%30==29) { flockfile(capture);stamp();fprintf(capture,"HEARTBEAT packets=%lu\n",atomic_load(&packets));funlockfile(capture); }
    }
    MIDIPortDispose(input); MIDIClientDispose(client);
    stamp(); fprintf(capture,"END packets=%lu reason=%s\n",atomic_load(&packets),connected?"duration_elapsed":"no_mosaic_source");
    fclose(capture); return connected?0:3;
}
