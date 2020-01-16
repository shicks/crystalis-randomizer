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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlsZWVmZmVjdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvanMvcm9tL3RpbGVlZmZlY3RzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUtoQyxNQUFNLE9BQU8sV0FBWSxTQUFRLE1BQU07SUFLckMsWUFBWSxHQUFRLEVBQUUsRUFBVTtRQUU5QixLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsT0FBTyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQsS0FBSyxDQUFDLE1BQWM7UUFDbEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM5QixNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM3QztJQUNILENBQUM7O0FBR00sZUFBRyxHQUFHLElBQUksQ0FBQztBQUNYLG1CQUFPLEdBQUcsSUFBSSxDQUFDO0FBQ2Ysc0JBQVUsR0FBRyxJQUFJLENBQUM7QUFDbEIsdUJBQVcsR0FBRyxJQUFJLENBQUM7QUFDbkIsa0JBQU0sR0FBRyxJQUFJLENBQUM7QUFDZCxpQkFBSyxHQUFHLElBQUksQ0FBQztBQUNiLGdCQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ1osZ0JBQUksR0FBRyxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0VudGl0eX0gZnJvbSAnLi9lbnRpdHkuanMnO1xuaW1wb3J0IHt0dXBsZX0gZnJvbSAnLi91dGlsLmpzJztcbmltcG9ydCB7V3JpdGVyfSBmcm9tICcuL3dyaXRlci5qcyc7XG5pbXBvcnQge1JvbX0gZnJvbSAnLi4vcm9tLmpzJztcblxuLy8gTWFwcHBpbmcgZnJvbSBtZXRhdGlsZSBJRCB0byBhIGJpdGZpZWxkIG9mIHRlcnJhaW4gZWZmZWN0c1xuZXhwb3J0IGNsYXNzIFRpbGVFZmZlY3RzIGV4dGVuZHMgRW50aXR5IHtcblxuICBiYXNlOiBudW1iZXI7XG4gIGVmZmVjdHM6IG51bWJlcltdO1xuXG4gIGNvbnN0cnVjdG9yKHJvbTogUm9tLCBpZDogbnVtYmVyKSB7XG4gICAgLy8gYGlkYCBpcyBNYXBEYXRhWzFdWzRdLCB3aGljaCByYW5nZXMgZnJvbSAkYjMuLiRiZFxuICAgIHN1cGVyKHJvbSwgaWQpO1xuICAgIHRoaXMuYmFzZSA9IChpZCA8PCA4KSAmIDB4MWZmZiB8IDB4MTIwMDA7XG4gICAgdGhpcy5lZmZlY3RzID0gdHVwbGUocm9tLnByZywgdGhpcy5iYXNlLCAyNTYpO1xuICB9XG5cbiAgd3JpdGUod3JpdGVyOiBXcml0ZXIpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDB4MTAwOyBpKyspIHtcbiAgICAgIHdyaXRlci5yb21bdGhpcy5iYXNlICsgaV0gPSB0aGlzLmVmZmVjdHNbaV07XG4gICAgfVxuICB9XG5cbiAgLy8gQml0czogZS5nLiBtb3VudGFpbiBpcyA2LCByaXZlciBpcyAyLCBwbGFpbiBpcyAwXG4gIHN0YXRpYyBQSVQgPSAweDAxO1xuICBzdGF0aWMgTk9fV0FMSyA9IDB4MDI7IC8vIGJ1dCBtYXliZSBzdGlsbCBjYW4gZmx5P1xuICBzdGF0aWMgSU1QQVNTSUJMRSA9IDB4MDQ7IC8vIG5laXRoZXIgd2Fsa2luZyBvciBmbHlpbmdcbiAgc3RhdGljIEFMVEVSTkFUSVZFID0gMHgwODsgLy8gbm90IHN1cmUgaWYgdGhpcyBpcyBhY3R1YWxseSB1c2VkP1xuICBzdGF0aWMgQkVISU5EID0gMHgxMDsgLy8gZS5nLiB1bmRlcm5lYXRoIGJyaWRnZVxuICBzdGF0aWMgU0xPUEUgPSAweDIwO1xuICBzdGF0aWMgU0xPVyA9IDB4NDA7IC8vIG5vdGU6IG9jZWFuIGlzIHNsb3cgYi9jIGRvbHBoaW4ncyBzcGVlZCBpcyA5XG4gIHN0YXRpYyBQQUlOID0gMHg4MDtcbn1cbiJdfQ==