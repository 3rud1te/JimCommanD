"""Read-only CoreMIDI endpoint diagnostic for macOS with PyObjC CoreMIDI.
No MIDI messages are sent. Errors are distinct from an empty device list.
"""
import json
import platform
import sys


def main():
    result = {"architecture": platform.machine(), "sent_messages": 0}
    try:
        import CoreMIDI as m
    except ImportError:
        result.update(error="PyObjC CoreMIDI is unavailable in this Python", status="unavailable")
        print(json.dumps(result, indent=2))
        return 2
    status, client = m.MIDIClientCreate("JimCommanD Inspection", None, None, None)
    result["client_status"] = status
    if status != 0:
        result.update(status="service_error", error="CoreMIDI client creation failed; this does not prove the pedal is disconnected")
        print(json.dumps(result, indent=2))
        return 2
    try:
        result["endpoints"] = []
        for kind, count, get in [("source", m.MIDIGetNumberOfSources(), m.MIDIGetSource), ("destination", m.MIDIGetNumberOfDestinations(), m.MIDIGetDestination)]:
            for index in range(count):
                endpoint = get(index)
                name_status, name = m.MIDIObjectGetStringProperty(endpoint, m.kMIDIPropertyDisplayName, None)
                offline_status, offline = m.MIDIObjectGetIntegerProperty(endpoint, m.kMIDIPropertyOffline, None)
                result["endpoints"].append({"kind": kind, "ref": endpoint, "name": str(name) if name_status == 0 else None, "offline": bool(offline) if offline_status == 0 else None})
        result["status"] = "enumerated"
        print(json.dumps(result, indent=2))
        return 0
    finally:
        m.MIDIClientDispose(client)


if __name__ == "__main__":
    sys.exit(main())
