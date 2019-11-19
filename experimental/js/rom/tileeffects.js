import { Entity } from './entity.js';
import { tuple } from './util.js';
export class TileEffects extends Entity {
    constructor(rom, id) {
        super(rom, id);
        this.base = (id << 8) & 0x1fff | 0x12000;
        this.effects = tuple(rom.prg, this.base, 256);
    }
    write(writer) {
        for (let i = 0; i < 0x100; i++) {
            writer.rom[this.base + i] = this.effects[i];
        }
    }
}
TileEffects.PIT = 0x01;
TileEffects.NO_WALK = 0x02;
TileEffects.IMPASSIBLE = 0x04;
TileEffects.ALTERNATIVE = 0x08;
TileEffects.BEHIND = 0x10;
TileEffects.SLOPE = 0x20;
TileEffects.SLOW = 0x40;
TileEffects.PAIN = 0x80;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlsZWVmZmVjdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvanMvcm9tL3RpbGVlZmZlY3RzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFdBQVcsQ0FBQztBQXlCaEMsTUFBTSxPQUFPLFdBQVksU0FBUSxNQUFNO0lBS3JDLFlBQVksR0FBUSxFQUFFLEVBQVU7UUFFOUIsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLE9BQU8sQ0FBQztRQUN6QyxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELEtBQUssQ0FBQyxNQUFjO1FBQ2xCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDOUIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDN0M7SUFDSCxDQUFDOztBQUdNLGVBQUcsR0FBRyxJQUFJLENBQUM7QUFDWCxtQkFBTyxHQUFHLElBQUksQ0FBQztBQUNmLHNCQUFVLEdBQUcsSUFBSSxDQUFDO0FBQ2xCLHVCQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ25CLGtCQUFNLEdBQUcsSUFBSSxDQUFDO0FBQ2QsaUJBQUssR0FBRyxJQUFJLENBQUM7QUFDYixnQkFBSSxHQUFHLElBQUksQ0FBQztBQUNaLGdCQUFJLEdBQUcsSUFBSSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtFbnRpdHl9IGZyb20gJy4vZW50aXR5LmpzJztcbmltcG9ydCB7dHVwbGV9IGZyb20gJy4vdXRpbC5qcyc7XG5pbXBvcnQge1dyaXRlcn0gZnJvbSAnLi93cml0ZXIuanMnO1xuaW1wb3J0IHtSb219IGZyb20gJy4uL3JvbS5qcyc7XG5cbi8vIGNvbnN0IEVGRkVDVFMgPSB7XG4vLyAgIDB4YjM6IDB4YjMsXG4vLyAgIDB4YjQ6IDB4YjQsXG4vLyAgIDB4YjU6IDB4YjUsXG4vLyAgIDB4YjY6IDB4YjYsXG4vLyAgIDB4Yjc6IDB4YjcsXG4vLyAgIDB4Yjg6IDB4YjgsXG4vLyAgIDB4Yjk6IDB4YjksXG4vLyAgIDB4YmE6IDB4YmEsXG4vLyAgIDB4YmI6IDB4YmIsXG4vLyAgIDB4YmM6IDB4YmMsXG4vLyAgIDB4YmQ6IDB4YmQsXG4vLyB9XG5cbi8vIGV4cG9ydCBjbGFzcyBBbGxUaWxlRWZmZWN0cyBleHRlbmRzIGNvbGxlY3Rpb25CYXNlPHR5cGVvZiBFRkZFQ1RTLCBUaWxlRWZmZWN0cz4odHJ1ZSkge1xuLy8gICBjb25zdHJ1Y3RvcihyZWFkb25seSByb206IFJvbSkge1xuLy8gICAgIHN1cGVyKEVGRkVDVFMsIChpZDogbnVtYmVyKSA9PiBuZXcgVGlsZUVmZmVjdHMocm9tLCBpZCkpO1xuLy8gICB9XG4vLyB9XG5cbi8vIE1hcHBwaW5nIGZyb20gbWV0YXRpbGUgSUQgdG8gYSBiaXRmaWVsZCBvZiB0ZXJyYWluIGVmZmVjdHNcbmV4cG9ydCBjbGFzcyBUaWxlRWZmZWN0cyBleHRlbmRzIEVudGl0eSB7XG5cbiAgYmFzZTogbnVtYmVyO1xuICBlZmZlY3RzOiBudW1iZXJbXTtcblxuICBjb25zdHJ1Y3Rvcihyb206IFJvbSwgaWQ6IG51bWJlcikge1xuICAgIC8vIGBpZGAgaXMgTWFwRGF0YVsxXVs0XSwgd2hpY2ggcmFuZ2VzIGZyb20gJGIzLi4kYmRcbiAgICBzdXBlcihyb20sIGlkKTtcbiAgICB0aGlzLmJhc2UgPSAoaWQgPDwgOCkgJiAweDFmZmYgfCAweDEyMDAwO1xuICAgIHRoaXMuZWZmZWN0cyA9IHR1cGxlKHJvbS5wcmcsIHRoaXMuYmFzZSwgMjU2KTtcbiAgfVxuXG4gIHdyaXRlKHdyaXRlcjogV3JpdGVyKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAweDEwMDsgaSsrKSB7XG4gICAgICB3cml0ZXIucm9tW3RoaXMuYmFzZSArIGldID0gdGhpcy5lZmZlY3RzW2ldO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJpdHM6IGUuZy4gbW91bnRhaW4gaXMgNiwgcml2ZXIgaXMgMiwgcGxhaW4gaXMgMFxuICBzdGF0aWMgUElUID0gMHgwMTtcbiAgc3RhdGljIE5PX1dBTEsgPSAweDAyOyAvLyBidXQgbWF5YmUgc3RpbGwgY2FuIGZseT9cbiAgc3RhdGljIElNUEFTU0lCTEUgPSAweDA0OyAvLyBuZWl0aGVyIHdhbGtpbmcgb3IgZmx5aW5nXG4gIHN0YXRpYyBBTFRFUk5BVElWRSA9IDB4MDg7IC8vIG5vdCBzdXJlIGlmIHRoaXMgaXMgYWN0dWFsbHkgdXNlZD9cbiAgc3RhdGljIEJFSElORCA9IDB4MTA7IC8vIGUuZy4gdW5kZXJuZWF0aCBicmlkZ2VcbiAgc3RhdGljIFNMT1BFID0gMHgyMDtcbiAgc3RhdGljIFNMT1cgPSAweDQwOyAvLyBub3RlOiBvY2VhbiBpcyBzbG93IGIvYyBkb2xwaGluJ3Mgc3BlZWQgaXMgOVxuICBzdGF0aWMgUEFJTiA9IDB4ODA7XG59XG4iXX0=