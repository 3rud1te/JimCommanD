#import <Foundation/Foundation.h>

typedef void (^MosaicReply)(NSDictionary *result, NSString *error);
typedef void (^MosaicEvent)(NSDictionary *event);

@interface MosaicMidi : NSObject
@property(copy) MosaicEvent eventHandler;
- (void)connect:(MosaicReply)reply;
- (void)readSlot:(NSUInteger)slot reply:(MosaicReply)reply;
- (void)sendControlChange:(NSUInteger)controller value:(NSUInteger)value reply:(MosaicReply)reply;
- (void)disconnect;
@end
