#import <AppKit/AppKit.h>

static const CGFloat W = 1080, H = 1920;

static NSColor *C(unsigned hex, CGFloat a) {
    return [NSColor colorWithCalibratedRed:((hex >> 16) & 255)/255.0
                                     green:((hex >> 8) & 255)/255.0
                                      blue:(hex & 255)/255.0 alpha:a];
}
static CGFloat clamp(CGFloat x) { return fmin(1, fmax(0, x)); }
static CGFloat smoothstep(CGFloat x) { x=clamp(x); return x*x*(3-2*x); }
static NSRect R(CGFloat x, CGFloat y, CGFloat w, CGFloat h) { return NSMakeRect(x, H-y-h, w, h); }

static void box(CGFloat x, CGFloat y, CGFloat w, CGFloat h, CGFloat radius, NSColor *fill, NSColor *stroke) {
    NSBezierPath *p=[NSBezierPath bezierPathWithRoundedRect:R(x,y,w,h) xRadius:radius yRadius:radius];
    [fill setFill]; [p fill];
    if (stroke) { [stroke setStroke]; p.lineWidth=2; [p stroke]; }
}

static void txt(NSString *s, CGFloat x, CGFloat y, CGFloat w, CGFloat size, NSFontWeight weight, NSColor *color, NSTextAlignment align, CGFloat kern) {
    NSMutableParagraphStyle *ps=[NSMutableParagraphStyle new]; ps.alignment=align;
    NSDictionary *a=@{NSFontAttributeName:[NSFont systemFontOfSize:size weight:weight], NSForegroundColorAttributeName:color, NSParagraphStyleAttributeName:ps, NSKernAttributeName:@(kern)};
    [s drawInRect:R(x,y,w,size*1.35) withAttributes:a];
}

static void circle(CGFloat x, CGFloat y, CGFloat d, NSColor *fill, NSColor *stroke) {
    NSBezierPath *p=[NSBezierPath bezierPathWithOvalInRect:R(x,y,d,d)]; [fill setFill]; [p fill];
    if(stroke){ [stroke setStroke]; p.lineWidth=2; [p stroke]; }
}

static void line(CGFloat x1,CGFloat y1,CGFloat x2,CGFloat y2,CGFloat width,NSColor *c){
    NSBezierPath *p=[NSBezierPath bezierPath]; [p moveToPoint:NSMakePoint(x1,H-y1)]; [p lineToPoint:NSMakePoint(x2,H-y2)]; p.lineWidth=width; p.lineCapStyle=NSLineCapStyleRound; [c setStroke]; [p stroke];
}

static void logo(CGFloat cx, CGFloat cy, CGFloat scale, CGFloat alpha) {
    NSColor *cyan=C(0x22D3EE,alpha), *dark=C(0x111318,alpha);
    circle(cx-80*scale,cy-80*scale,160*scale,cyan,nil);
    circle(cx-58*scale,cy-58*scale,116*scale,dark,nil);
    line(cx,cy-60*scale,cx,cy-8*scale,10*scale,C(0xF6FFFF,alpha));
    circle(cx-10*scale,cy-10*scale,20*scale,cyan,nil);
}

static void knob(CGFloat cx, CGFloat cy, CGFloat v, NSColor *accent, NSString *label) {
    circle(cx-57,cy-57,114,C(0x20242B,1),C(0x363C47,1));
    CGFloat a=(-135+270*clamp(v))*M_PI/180.0;
    line(cx,cy,cx+sin(a)*40,cy-cos(a)*40,7,accent);
    txt([NSString stringWithFormat:@"%d",(int)round(v*100)],cx-45,cy+70,90,24,NSFontWeightSemibold,C(0xF1F5F9,1),NSTextAlignmentCenter,0);
    txt(label,cx-72,cy+106,144,15,NSFontWeightSemibold,C(0x89919F,1),NSTextAlignmentCenter,1.1);
}

static void chain(CGFloat y, NSInteger active) {
    NSArray *names=@[@"IN",@"FX1",@"FX2",@"PED",@"AMP",@"CAB",@"DEL",@"MOD",@"REV",@"EQ",@"OUT"];
    CGFloat start=91,gap=89;
    line(start,y+30,start+gap*(names.count-1),y+30,3,C(0x2A2E37,1));
    for(NSInteger i=0;i<names.count;i++){
        CGFloat x=start+gap*i; BOOL on=i==active;
        NSColor *ac=[names[i] isEqual:@"PED"]?C(0xF59E0B,1):([names[i] isEqual:@"CAB"]?C(0x84CC16,1):C(0x22D3EE,1));
        circle(x-24,y+6,48,on?C([names[i] isEqual:@"PED"]?0xF59E0B:([names[i] isEqual:@"CAB"]?0x84CC16:0x22D3EE),.22):C(0x1B1E24,1),on?ac:C(0x343943,1));
        txt(names[i],x-38,y+68,76,14,NSFontWeightBold,on?ac:C(0x737B88,1),NSTextAlignmentCenter,.4);
    }
}

static void interface(CGFloat t) {
    CGFloat p=smoothstep((t-.72)/.42), oy=(1-p)*170;
    [[NSGraphicsContext currentContext] saveGraphicsState];
    CGContextSetAlpha([[NSGraphicsContext currentContext] CGContext],p);
    box(40,470+oy,1000,1030,30,C(0x111318,1),C(0x2A2E37,1));
    box(40,470+oy,1000,82,30,C(0x0D0F13,1),nil); box(40,515+oy,1000,37,0,C(0x0D0F13,1),nil);
    circle(72,502+oy,16,C(0xFF5F57,1),nil); circle(101,502+oy,16,C(0xFFBD2E,1),nil); circle(130,502+oy,16,C(0x28C840,1),nil);
    txt(@"JimCommanD",340,493+oy,400,25,NSFontWeightSemibold,C(0xF1F5F9,1),NSTextAlignmentCenter,.8);
    txt(@"MOSAIC  •  USB",790,498+oy,200,15,NSFontWeightSemibold,C(0x22D3EE,1),NSTextAlignmentRight,1);
    NSInteger stage=t<2.05?4:(t<3.05?3:(t<4.05?5:8));
    chain(635+oy,stage);
    NSString *title=stage==4?@"AMPLIFIER":(stage==3?@"PEDAL CAPTURE":(stage==5?@"CABINET IR":@"REVERB"));
    NSString *sub=stage==4?@"20 DEDICATED NAM POSITIONS":(stage==3?@"10 DEDICATED NAM POSITIONS":(stage==5?@"CUSTOM IMPULSE RESPONSE":@"ALGORITHMIC SPACE"));
    NSColor *ac=stage==3?C(0xF59E0B,1):(stage==5?C(0x84CC16,1):C(0x22D3EE,1));
    txt(title,88,766+oy,600,23,NSFontWeightBold,ac,NSTextAlignmentLeft,2);
    txt(sub,88,808+oy,600,15,NSFontWeightMedium,C(0x89919F,1),NSTextAlignmentLeft,1.2);
    box(82,855+oy,916,420,20,C(0x181B21,1),C(0x252A33,1));
    NSArray *labs=stage==4?@[@"GAIN",@"BASS",@"MID",@"TREBLE"]:(stage==3?@[@"INPUT",@"DRIVE",@"TONE",@"OUTPUT"]:(stage==5?@[@"LOW CUT",@"HIGH CUT",@"LEVEL",@"IR SELECT"]:@[@"DECAY",@"PRE-DELAY",@"MIX",@"DAMPING"]));
    for(int i=0;i<4;i++){ CGFloat v=.5+.42*sin(t*5.2+i*1.47); knob(210+i*220,1015+oy,v,ac,labs[i]); }
    box(104,1292+oy,872,94,16,C(0x181B21,1),[ac colorWithAlphaComponent:.45]);
    NSString *slot=stage==4?@"AMPLIFIER 01   →   HARDWARE NAM 01":(stage==3?@"PEDAL 01   →   HARDWARE NAM 21":(stage==5?@"CABINET IR 01   •   4×12 VINTAGE":@"HALL   •   PRESET-SAVED PARAMETERS"));
    txt(slot,120,1323+oy,840,19,NSFontWeightSemibold,C(0xF1F5F9,1),NSTextAlignmentCenter,.4);
    txt(@"●  MOSAIC CONNECTED",86,1441+oy,300,14,NSFontWeightSemibold,C(0x28C840,1),NSTextAlignmentLeft,1);
    txt(@"INTEL MACINTOSH  •  48 kHz",680,1441+oy,310,14,NSFontWeightMedium,C(0x89919F,1),NSTextAlignmentRight,.6);
    [[NSGraphicsContext currentContext] restoreGraphicsState];
}

static void render(CGFloat t) {
    [C(0x07090C,1) setFill]; NSRectFill(NSMakeRect(0,0,W,H));
    if(t<1.25){ CGFloat p=smoothstep(t/.45); logo(540,410,.9,p); txt(@"JimCommanD",90,620,900,82,NSFontWeightBold,C(0xF6F7F9,p),NSTextAlignmentCenter,-1); txt(@"FOR INTEL MACINTOSH",90,744,900,24,NSFontWeightBold,C(0x22D3EE,p),NSTextAlignmentCenter,5); txt(@"MOSAIC TONE CONTROL  •  REIMAGINED",90,811,900,18,NSFontWeightMedium,C(0x89919F,p),NSTextAlignmentCenter,2); }
    if(t>=.72 && t<5.25) interface(t);
    if(t>=5.0){ CGFloat p=smoothstep((t-5)/.28); box(0,0,W,H,0,C(0x07090C,p),nil); logo(540,505,.82,p); txt(@"JimCommanD",90,660,900,78,NSFontWeightBold,C(0xF6F7F9,p),NSTextAlignmentCenter,-1); txt(@"YOUR MOSAIC. YOUR SOUND.",90,785,900,28,NSFontWeightBold,C(0x22D3EE,p),NSTextAlignmentCenter,2.5); txt(@"20 AMP  •  10 PEDAL  •  CUSTOM IR",90,860,900,20,NSFontWeightSemibold,C(0x89919F,p),NSTextAlignmentCenter,1.4); txt(@"FOR INTEL MACINTOSH",90,1335,900,21,NSFontWeightSemibold,C(0xF1F5F9,p),NSTextAlignmentCenter,4); }
}

int main(void){ @autoreleasepool {
    NSString *dir=@"/private/tmp/jimcommand-frames"; [[NSFileManager defaultManager] removeItemAtPath:dir error:nil]; [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
    for(int f=0;f<180;f++){ @autoreleasepool {
        NSBitmapImageRep *bmp=[[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:1080 pixelsHigh:1920 bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
        NSGraphicsContext *gc=[NSGraphicsContext graphicsContextWithBitmapImageRep:bmp]; [NSGraphicsContext saveGraphicsState]; [NSGraphicsContext setCurrentContext:gc]; render(f/30.0); [gc flushGraphics]; [NSGraphicsContext restoreGraphicsState];
        NSData *png=[bmp representationUsingType:NSBitmapImageFileTypePNG properties:@{}]; NSString *path=[dir stringByAppendingPathComponent:[NSString stringWithFormat:@"frame_%03d.png",f]]; [png writeToFile:path atomically:NO];
    }}
    printf("%s\n",dir.UTF8String);
} return 0; }
