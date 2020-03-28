import { seq } from './util.js';
export const featureMask = {
    'pit': 0x1,
    'arena': 0x2,
    'spikes': 0x4,
    'bridge': 0x8,
    'wall': 0x10,
    'stairs': 0x20,
    'stair:up': 0x40,
    'stair:down': 0x80,
    'empty': 0x100,
    'portoa1': 0x200,
    'portoa2': 0x400,
    'portoa3': 0x800,
    'lake': 0x1000,
    'overBridge': 0x2000,
    'underBridge': 0x4000,
    'whirlpool': 0x8000,
    'lighthouse': 65536,
    'cabin': 131072,
    'windmill': 262144,
    'altar': 524288,
    'pyramid': 1048576,
    'crypt': 2097152,
    'consolidate': 4194304,
};
export function icon(arr) {
    if (arr.length != 1)
        throw new Error('Bad icon input');
    const str = arr[0];
    const lines = str.split('\n');
    const full = lines.slice(1).map(l => l.replace(/^\s*\||\|\s*$/g, ''));
    const short = /\S/.test(lines[0]) ? lines[0][0] : full[1][1];
    return { short, full: [full[0], full[1], full[2]] };
}
export function upStair(tile, width = 2) {
    const y = tile >>> 4;
    const x = tile & 0xf;
    if (width === 1) {
        const dy = y === 0xe ? 0x2800 : 0x1800;
        const entrance = ((y << 12) + dy) | ((x << 4) + 0x0008);
        return {
            type: 'stair:up',
            dir: 2,
            entrance,
            exits: [tile],
        };
    }
    const entrance = y << 12 | ((x << 4) + (width << 3));
    return {
        type: 'stair:up',
        dir: 0,
        entrance,
        exits: seq(width, i => tile - 0x10 + i),
    };
}
export function downStair(tile, width = 2) {
    const y = tile >>> 4;
    const x = tile & 0xf;
    if (width === 1) {
        const entrance = ((y << 12) - 0x0800) | ((x << 4) + 0x0008);
        return {
            type: 'stair:down',
            dir: 2,
            entrance,
            exits: [tile],
        };
    }
    const entrance = y << 12 | 0x0f00 | ((x << 4) + (width << 3));
    return {
        type: 'stair:down',
        dir: 2,
        entrance,
        exits: seq(width, i => tile + 0x10 + i),
    };
}
export function cave(tile, type = 'cave') {
    return { ...upStair(tile + 16), type };
}
export function door(tile, type = 'door') {
    return { ...upStair(tile, 1), type };
}
export function waterfallCave(tile) {
    const y = tile >>> 4;
    const x = tile & 0xf;
    return {
        type: 'cave',
        dir: 0,
        entrance: y << 12 | x << 4 | 0xf,
        exits: [tile - 0xf, tile + 1],
    };
}
export function topEdge({ left = 7, width = 2, top = 2, manual = false } = {}) {
    return {
        type: 'edge:top',
        manual,
        dir: 0,
        entrance: ((top + 1) << 12) | ((left << 4) + (width << 3)),
        exits: seq(width, i => (top << 4) | (i + left)),
    };
}
export function bottomEdge({ left = 7, width = 2, shift = 0, type = 'edge:bottom', manual = false } = {}) {
    return {
        type, manual,
        dir: 2,
        entrance: 57088 | ((left << 4) + (width << 3) + 16 * shift),
        exits: seq(width, i => 0xe0 | (i + left)),
    };
}
export function bottomEdgeHouse({ left = 7, width = 2, shift = 0 } = {}) {
    return {
        type: 'edge:bottom',
        dir: 2,
        entrance: 44800 | ((left << 4) + (width << 3) + 16 * shift),
        exits: seq(width, i => 0xb0 | (i + left)),
    };
}
export function leftEdge({ top = 7, height = 2, shift = 0 } = {}) {
    return {
        type: 'edge:left',
        dir: 1,
        entrance: ((top << 12) + ((16 * shift) << 8) + (height << 11)) | 0x10,
        exits: seq(height, i => (i + top) << 4),
    };
}
export function rightEdge({ top = 7, height = 2 } = {}) {
    return {
        type: 'edge:right',
        dir: 3,
        entrance: ((top << 12) + (height << 11)) | 0xef,
        exits: seq(height, i => (i + top) << 4 | 0xf),
    };
}
export function seamlessUp(tile, width = 2) {
    return {
        type: 'seamless:up',
        dir: 0,
        get entrance() { throw new Error('does not make sense'); },
        exits: seq(width, i => (tile + i)),
    };
}
export function seamlessDown(tile, width = 2) {
    return {
        type: 'seamless:down',
        dir: 2,
        get entrance() { throw new Error('does not make sense'); },
        exits: seq(width, i => (tile + i)),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YXNjcmVlbmRhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvanMvcm9tL21ldGFzY3JlZW5kYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFxRjlCLE1BQU0sQ0FBQyxNQUFNLFdBQVcsR0FBRztJQUV6QixLQUFLLEVBQUUsR0FBRztJQUNWLE9BQU8sRUFBRSxHQUFHO0lBQ1osUUFBUSxFQUFFLEdBQUc7SUFDYixRQUFRLEVBQUUsR0FBRztJQUNiLE1BQU0sRUFBRSxJQUFJO0lBQ1osUUFBUSxFQUFFLElBQUk7SUFDZCxVQUFVLEVBQUUsSUFBSTtJQUNoQixZQUFZLEVBQUUsSUFBSTtJQUNsQixPQUFPLEVBQUUsS0FBSztJQUNkLFNBQVMsRUFBRSxLQUFLO0lBQ2hCLFNBQVMsRUFBRSxLQUFLO0lBQ2hCLFNBQVMsRUFBRSxLQUFLO0lBQ2hCLE1BQU0sRUFBRSxNQUFNO0lBQ2QsWUFBWSxFQUFFLE1BQU07SUFDcEIsYUFBYSxFQUFFLE1BQU07SUFDckIsV0FBVyxFQUFFLE1BQU07SUFDbkIsWUFBWSxFQUFFLEtBQVE7SUFDdEIsT0FBTyxFQUFFLE1BQVE7SUFDakIsVUFBVSxFQUFFLE1BQVE7SUFDcEIsT0FBTyxFQUFFLE1BQVE7SUFDakIsU0FBUyxFQUFFLE9BQVM7SUFDcEIsT0FBTyxFQUFFLE9BQVM7SUFDbEIsYUFBYSxFQUFFLE9BQVM7Q0FDaEIsQ0FBQztBQWNYLE1BQU0sVUFBVSxJQUFJLENBQUMsR0FBeUI7SUFDNUMsSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDdkQsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRW5CLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7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QUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDMUQsS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztLQUNoRCxDQUFDO0FBQ0osQ0FBQztBQUlELE1BQU0sVUFBVSxVQUFVLENBQUMsRUFBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFDOUIsSUFBSSxHQUFHLGFBQStCLEVBQ3RDLE1BQU0sR0FBRyxLQUFLLEtBQUksRUFBRTtJQUk5QyxPQUFPO1FBQ0wsSUFBSSxFQUFFLE1BQU07UUFDWixHQUFHLEVBQUUsQ0FBQztRQUNOLFFBQVEsRUFBRSxLQUFPLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQzdELEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0tBQzFDLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLGVBQWUsQ0FBQyxFQUFDLElBQUksR0FBRyxDQUFDLEVBQ1IsS0FBSyxHQUFHLENBQUMsRUFDVCxLQUFLLEdBQUcsQ0FBQyxFQUFDLEdBQUcsRUFBRTtJQUc5QyxPQUFPO1FBQ0wsSUFBSSxFQUFFLGFBQWE7UUFDbkIsR0FBRyxFQUFFLENBQUM7UUFDTixRQUFRLEVBQUUsS0FBTyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUM3RCxLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztLQUMxQyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sVUFBVSxRQUFRLENBQUMsRUFBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLE1BQU0sR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBQyxHQUFHLEVBQUU7SUFDNUQsT0FBTztRQUNMLElBQUksRUFBRSxXQUFXO1FBQ2pCLEdBQUcsRUFBRSxDQUFDO1FBQ04sUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUk7UUFDckUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDeEMsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUsU0FBUyxDQUFDLEVBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFDLEdBQUcsRUFBRTtJQUNsRCxPQUFPO1FBQ0wsSUFBSSxFQUFFLFlBQVk7UUFDbEIsR0FBRyxFQUFFLENBQUM7UUFDTixRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUk7UUFDL0MsS0FBSyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDO0tBQzlDLENBQUM7QUFDSixDQUFDO0FBR0QsTUFBTSxVQUFVLFVBQVUsQ0FBQyxJQUFZLEVBQUUsS0FBSyxHQUFHLENBQUM7SUFDaEQsT0FBTztRQUNMLElBQUksRUFBRSxhQUFhO1FBQ25CLEdBQUcsRUFBRSxDQUFDO1FBQ04sSUFBSSxRQUFRLEtBQWEsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ25DLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxJQUFZLEVBQUUsS0FBSyxHQUFHLENBQUM7SUFDbEQsT0FBTztRQUNMLElBQUksRUFBRSxlQUFlO1FBQ3JCLEdBQUcsRUFBRSxDQUFDO1FBQ04sSUFBSSxRQUFRLEtBQWEsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ25DLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtNZXRhc2NyZWVufSBmcm9tICcuL21ldGFzY3JlZW4uanMnO1xuaW1wb3J0IHtTY3JlZW5GaXh9IGZyb20gJy4vc2NyZWVuZml4LmpzJztcbmltcG9ydCB7TWV0YXRpbGVzZXRzfSBmcm9tICcuL21ldGF0aWxlc2V0LmpzJztcbmltcG9ydCB7c2VxfSBmcm9tICcuL3V0aWwuanMnO1xuaW1wb3J0IHtSb219IGZyb20gJy4uL3JvbS5qcyc7XG5cbi8qKlxuICogTWV0YWRhdGEgYWJvdXQgdGhlIG1ldGFzY3JlZW4uICBCZWNhdXNlIHRoZXNlIGFyZSBjcmVhdGVkIHBlciBNZXRhc2NyZWVuc1xuICogaW5zdGFuY2UsIHRoZXkgY2FuIGFjdHVhbGx5IGJlIG11dGF0ZWQgYXMgbmVlZGVkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE1ldGFzY3JlZW5EYXRhIHtcbiAgLyoqXG4gICAqIElmIHRoZSBzY3JlZW4gZXhpc3RzIG9yIGlzIHNoYXJlZCB3aXRoIGEgc2NyZWVuIGluIHRoZSB2YW5pbGxhIHJvbSwgdGhlblxuICAgKiB0aGlzIGlzIHRoZSBzY3JlZW4gSUQgKDAuLjEwMikuICBPdGhlcndpc2UsIGl0IGlzIGEgc3BhcnNlIG5lZ2F0aXZlIG51bWJlclxuICAgKiBzaGFyZWQgYnkgYWxsIHRoZSBzY3JlZW5zIHRoYXQgd2lsbCB1bHRpbWF0ZWx5IGhhdmUgdGhlIHNhbWUgSUQuXG4gICAqL1xuICByZWFkb25seSBpZDogbnVtYmVyO1xuICAvKiogUmVwcmVzZW50YXRpdmUgaWNvbiBmb3IgZGVidWcgcHVycG9zZXMuICovXG4gIGljb24/OiBJY29uO1xuICAvKiogTGlzdCBvZiB0aWxlc2V0cyB0aGlzIHNjcmVlbiBhcHBlYXJzIGluLiAqL1xuICB0aWxlc2V0czoge1tuYW1lIGluIGtleW9mIE1ldGF0aWxlc2V0c10/OiB7XG4gICAgLyoqIEZpeGVzIG5lZWRlZCBiZWZvcmUgc2NyZWVuIGlzIHVzYWJsZSBpbiB0aGUgdGlsZXNldC4gKi9cbiAgICByZXF1aXJlcz86IFNjcmVlbkZpeFtdLFxuICAgIC8qKiA/Pz8gKi9cbiAgICB0eXBlPzogc3RyaW5nLCAvLyBmb3IgdG93bj9cbiAgfX07XG4gIC8qKiBMaXN0IG9mIGZlYXR1cmVzIHByZXNlbnQuICovXG4gIGZlYXR1cmU/OiBGZWF0dXJlW107XG4gIC8qKiBMaXN0IG9mIGV4aXQgc3BlY3MuICovXG4gIGV4aXRzPzogcmVhZG9ubHkgQ29ubmVjdGlvbltdO1xuICAvKiogU3RyaW5nIChsZW5ndGggNCkgb2YgZWRnZSB0eXBlcyBmb3IgbWF0Y2hpbmc6IHVwLCBsZWZ0LCBkb3duLCByaWdodC4gKi9cbiAgZWRnZXM/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBTdHJpbmcgb2YgY29ubmVjdGVkIGFjY2VzcyBwb2ludHMgZm9yIHJvdXRpbmcsIGdyb3VwZWQgYnkgY29ubmVjdGlvbiB0eXBlLlxuICAgKiBQb2ludHMgYXJlIGhleCBkaWdpdHMgWzEyM10gZm9yIHRvcCBlZGdlLCBbNTY3XSBmb3IgbGVmdCwgWzlhYl0gZm9yIGJvdHRvbSxcbiAgICogb3IgW2RlZl0gZm9yIHJpZ2h0IGVkZ2UuICBTZXBhcmF0b3JzIGFyZSAnfCcgZm9yIGltcGFzc2libGUsICc9JyBmb3Igd2FsbCxcbiAgICogJzonIGZvciB3YXRlciAoaS5lLiBmbGlnaHQgcmVxdWlyZWQpLCBhbmQgJy0nIGZvciBicmlkZ2UuICBHZW5lcmFsbHkgb25seVxuICAgKiB0aGUgbWlkZGxlIG51bWJlciBpcyB1c2VkIGZvciBlYWNoIGVkZ2UgKDI2YWUpIGJ1dCBmb3Igcml2ZXJzIGFuZCBsYWJ5cmludGhcbiAgICogdGlsZXNldHMsIHRoZSBvdGhlciBudW1iZXJzIGFyZSB1c2VkIGFzIHdlbGwsIGNvdmVyaW5nIHRoZSBlZGdlcyBsaWtlIHNvXG4gICAqIGBgYFxuICAgKiAgICAgLjEyMy5cbiAgICogICAgIDUgICBkXG4gICAqICAgICA2ICAgZVxuICAgKiAgICAgNyAgIGZcbiAgICogICAgIC45YWIuXG4gICAqIGBgYFxuICAgKiBUaHVzIHRoZSA0IGJpdCBpbmRpY2F0ZXMgYSB2ZXJ0aWNhbCBlZGdlIGFuZCB0aGUgOCBiaXQgaW5kaWNhdGVzIHRoYXQgaXQnc1xuICAgKiB0aGUgY29ycmVzcG9uZGluZyBlZGdlIG9uIHRoZSBuZXh0IHRpbGUuXG4gICAqL1xuICBjb25uZWN0Pzogc3RyaW5nO1xuICAvKiogVGlsZSAoeXgpIHRvIHBsYWNlIHRoZSB3YWxsL2JyaWRnZSBoaXRib3gsIGlmIHByZXNlbnQuICovXG4gIHdhbGw/OiBudW1iZXI7XG4gIC8qKiBJbmZvcm1hdGlvbiBhYm91dCBhbnkgbW92aW5nIHBsYXRmb3JtIHBsYXRmb3JtLiAqL1xuICBwbGF0Zm9ybT86IHtcbiAgICAvKiogVHlwZSBvZiBwbGF0Zm9ybS4gKi9cbiAgICB0eXBlOiAnaG9yaXpvbnRhbCcgfCAndmVydGljYWwnLFxuICAgIC8qKiAxNi1iaXQgc2NyZWVuIGNvb3JkaW5hdGVzICh5eXh4KSBvZiBwbGF0Zm9ybSBzcGF3biBwb3NpdGlvbi4gKi9cbiAgICBjb29yZDogbnVtYmVyLFxuICB9O1xuICAvKipcbiAgICogUG9pbnRzIG9mIGludGVyZXN0IG9uIHRoaXMgc2NyZWVuLiAgRWFjaCBlbnRyeSBpcyBhIHByaW9yaXR5ICgxIGlzIG1vc3RcbiAgICogcmVsZXZhbnQsIDUgaXMgbGVhc3QpLCBmb2xsb3dlZCBieSBhIGRlbHRhLXkgYW5kIGEgZGVsdGEteCBpbiBwaXhlbHNcbiAgICogbWVhc3VyZWQgZnJvbSB0aGUgdG9wLWxlZnQgY29ybmVyIG9mIHRoZSBzY3JlZW4uICBUaGUgZGVsdGFzIG1heSBiZVxuICAgKiBuZWdhdGl2ZSBvciBncmVhdGVyIHRoYW4gMHhmZiwgaW5kaWNhdGluZyB0aGF0IHRoZSBQT0kgaXMgYWN0dWFsbHkgb24gYVxuICAgKiBuZWlnaGJvcmluZyBzY3JlZW4uICBEZWZhdWx0IGR5PTcwIGFuZCBkeD03OC5cbiAgICovXG4gIHBvaT86IFJlYWRvbmx5QXJyYXk8cmVhZG9ubHkgW251bWJlciwgbnVtYmVyPywgbnVtYmVyP10+LFxuXG4gIC8qKiBVcGRhdGVzIHRvIGFwcGx5IHdoZW4gYXBwbHlpbmcgdGhlIGdpdmVuIGZpeC4gKi9cbiAgdXBkYXRlPzogUmVhZG9ubHlBcnJheTxyZWFkb25seSBbU2NyZWVuRml4LCBTY3JlZW5VcGRhdGVdPjtcblxuICAvKiogV2hldGhlciBhIHNwZWNpYWwgZmxhZyBpcyBuZWVkZWQgZm9yIHRoaXMgc2NyZWVuLiAqL1xuICBmbGFnPzogJ2Fsd2F5cycgfCAnY2FsbScgfCAnY3VzdG9tOmZhbHNlJyB8ICdjdXN0b206dHJ1ZSc7IC8vIHwgJ2Jvc3MnO1xuXG4gIC8qKlxuICAgKiBMaXN0IG9mIGRpcmVjdGlvbnMgdGhlIG90aGVyIHNjcmVlbiBtYXkgYmUgaW4gcmVsYXRpb24gdG8gdGhpcy5cbiAgICogVGhpcyBpcyBvbiB0b3Agb2YgYW55dGhpbmcgdGhhdCBtYXRjaGVzIG9uIGVkZ2UgdHlwZXMsIGFuZCBpc1xuICAgKiBwYXJ0aWN1bGFybHkgdXNlZnVsIGZvciBtYXRjaGluZyAnKicgZWRnZSB0eXBlcy5cbiAgICovXG4gIGFsbG93ZWQ/OiAoczogTWV0YXNjcmVlbikgPT4gQXJyYXk8MHwxfDJ8Mz47XG5cbiAgLyoqIENvbmRpdGlvbnMgZm9yIG1hdGNoaW5nIHRoaXMgdGlsZS4gKi9cbiAgbWF0Y2g/OiAocmVhY2hhYmxlOiAoZHk6IG51bWJlciwgZHg6IG51bWJlcikgPT4gYm9vbGVhbixcbiAgICAgICAgICAgZmxhZzogYm9vbGVhbikgPT4gYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgU2NyZWVuVXBkYXRlID0gKHM6IE1ldGFzY3JlZW4sIHNlZWQ6IG51bWJlciwgcm9tOiBSb20pID0+IGJvb2xlYW47XG5cbmV4cG9ydCBjb25zdCBmZWF0dXJlTWFzayA9IHtcbiAgLy8gVE9ETyAtIGNhdmU/IGZvcnRyZXNzPyBlZGdlPyAgd2UgYWxyZWFkeSBoYXZlIGNvbm5lY3Rpb25zIHRvIHRlbGwgdXMuLi5cbiAgJ3BpdCc6IDB4MSxcbiAgJ2FyZW5hJzogMHgyLFxuICAnc3Bpa2VzJzogMHg0LFxuICAnYnJpZGdlJzogMHg4LFxuICAnd2FsbCc6IDB4MTAsXG4gICdzdGFpcnMnOiAweDIwLFxuICAnc3RhaXI6dXAnOiAweDQwLCAvLyBOT1RFOiBub3QgYWN0dWFsbHkgbGlzdGVkLCBpbnN0ZWFkIHB1bGxlZCBmcm9tIGV4aXRUeXBlXG4gICdzdGFpcjpkb3duJzogMHg4MCxcbiAgJ2VtcHR5JzogMHgxMDAsXG4gICdwb3J0b2ExJzogMHgyMDAsIC8vIFRPRE8gLSBjb25zaWRlciBhIHNpbmdsZSBcInVuaXF1ZVwiIG1hc2sgaGVyZT9cbiAgJ3BvcnRvYTInOiAweDQwMCwgLy8gT3IgLSBhbGwgMjAgY29tYmluYXRpb25zIG9mIDMvNiBiaXRzOiBubyBtdXR1YWwgc3Vic2V0XG4gICdwb3J0b2EzJzogMHg4MDAsIC8vIDcsYixkLGUsMTMsMTUsMTYsMTksMWEsMWMsMjMsMjUsMjYsMjksMmEsMmMsMzEsMzIsMzQsMzhcbiAgJ2xha2UnOiAweDEwMDAsXG4gICdvdmVyQnJpZGdlJzogMHgyMDAwLFxuICAndW5kZXJCcmlkZ2UnOiAweDQwMDAsXG4gICd3aGlybHBvb2wnOiAweDgwMDAsXG4gICdsaWdodGhvdXNlJzogMHgxXzAwMDAsXG4gICdjYWJpbic6IDB4Ml8wMDAwLFxuICAnd2luZG1pbGwnOiAweDRfMDAwMCxcbiAgJ2FsdGFyJzogMHg4XzAwMDAsXG4gICdweXJhbWlkJzogMHgxMF8wMDAwLFxuICAnY3J5cHQnOiAweDIwXzAwMDAsXG4gICdjb25zb2xpZGF0ZSc6IDB4NDBfMDAwMCwgLy8gaW5kaWNhdGVzIHdlIGNhbiBjb25zb2xpZGF0ZSB0aGlzIHNjcmVlbi5cbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIEZlYXR1cmUgPSBrZXlvZiB0eXBlb2YgZmVhdHVyZU1hc2s7XG4gIC8vICdwaXQnIHwgJ2FyZW5hJyB8ICdzcGlrZXMnIHwgJ2JyaWRnZScgfCAnd2FsbCcgfCAnc3RhaXJzJyB8ICdlbXB0eScgfFxuICAvLyAncG9ydG9hMScgfCAncG9ydG9hMicgfCAncG9ydG9hMycgfCAvLyBwYXRoIGZyb20gc2FicmUgdG8gcG9ydG9hXG4gIC8vICdsYWtlJyB8ICdvdmVyQnJpZGdlJyB8ICd1bmRlckJyaWRnZScgfCAnd2hpcmxwb29sJyB8XG4gIC8vICdsaWdodGhvdXNlJyB8ICdjYWJpbicgfCAnd2luZG1pbGwnIHwgJ2FsdGFyJyB8ICdweXJhbWlkJyB8ICdjcnlwdCcgfFxuICAvLyAnY29uc29saWRhdGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEljb24ge1xuICBzaG9ydDogc3RyaW5nOyAvLyBzaW5nbGUgY2hhcmFjdGVyXG4gIGZ1bGw6IHJlYWRvbmx5IFtzdHJpbmcsIHN0cmluZywgc3RyaW5nXTsgLy8gM3gzIGdyaWRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljb24oYXJyOiBUZW1wbGF0ZVN0cmluZ3NBcnJheSk6IEljb24ge1xuICBpZiAoYXJyLmxlbmd0aCAhPSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0JhZCBpY29uIGlucHV0Jyk7XG4gIGNvbnN0IHN0ciA9IGFyclswXTtcbiAgLy8gcGFyc2UgdGhlIHN0cmluZy5cbiAgY29uc3QgbGluZXMgPSBzdHIuc3BsaXQoJ1xcbicpO1xuICAvLyBsaW5lcyAxLi4zIGFyZSB0aGUgZnVsbCBpY29uLlxuICBjb25zdCBmdWxsID0gbGluZXMuc2xpY2UoMSkubWFwKGwgPT4gbC5yZXBsYWNlKC9eXFxzKlxcfHxcXHxcXHMqJC9nLCAnJykpO1xuICBjb25zdCBzaG9ydCA9IC9cXFMvLnRlc3QobGluZXNbMF0pID8gbGluZXNbMF1bMF0gOiBmdWxsWzFdWzFdO1xuICByZXR1cm4ge3Nob3J0LCBmdWxsOiBbZnVsbFswXSwgZnVsbFsxXSwgZnVsbFsyXV19O1xufVxuXG5cbmV4cG9ydCB0eXBlIFN0YWlyVHlwZSA9ICdzdGFpcjp1cCcgfCAnc3RhaXI6ZG93bic7XG5leHBvcnQgdHlwZSBFZGdlVHlwZSA9ICdlZGdlOnRvcCcgfCAnZWRnZTpib3R0b20nIHwgJ2VkZ2U6bGVmdCcgfCAnZWRnZTpyaWdodCc7XG5leHBvcnQgdHlwZSBTZWFtbGVzc1R5cGUgPSAnc2VhbWxlc3M6dXAnIHwgJ3NlYW1sZXNzOmRvd24nO1xuZXhwb3J0IHR5cGUgQ29ubmVjdGlvblR5cGUgPVxuICAgIFN0YWlyVHlwZSB8IEVkZ2VUeXBlIHwgU2VhbWxlc3NUeXBlIHxcbiAgICAnY2F2ZScgfCAnZG9vcicgfCAnZG9vcjInIHwgJ2Rvb3IzJyB8ICdmb3J0cmVzcycgfCAnZ2F0ZScgfFxuICAgICdzd2FtcCcgfCAndGVsZXBvcnRlcicgfCAnd2luZG1pbGwnO1xuLy8gVE9ETyAtIGlzIHdpbmRtaWxsIGp1c3QgZG9vcjI/XG5cbi8vIE5PVEU6IHN3YW1wIGNvbm5lY3RzIHRvIGVkZ2U6Ym90dG9tIGZvciBjYXZlIG9yIHRvd24/XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29ubmVjdGlvbiB7XG4gIHJlYWRvbmx5IHR5cGU6IENvbm5lY3Rpb25UeXBlO1xuICByZWFkb25seSBtYW51YWw/OiBib29sZWFuOyAgICAgICAgIC8vIHNob3VsZCBvbmx5IGJlIHBsYWNlZCBtYW51YWxseVxuICByZWFkb25seSBkaXI6IG51bWJlcjsgICAgICAgICAgICAgIC8vIDA9dXAsIDE9bGVmdCwgMj1kb3duLCAzPXJpZ2h0XG4gIHJlYWRvbmx5IGVudHJhbmNlOiBudW1iZXI7ICAgICAgICAgLy8gcG9zIFl5WHhcbiAgcmVhZG9ubHkgZXhpdHM6IHJlYWRvbmx5IG51bWJlcltdOyAvLyB0aWxlIFlYXG4gIC8vIFRPRE8gLSBzaW5nbGVIZWlnaHRFbnRyYW5jZSAtIGZvciBkaXI9MiBqdXN0IHN1YnRyYWN0IDB4MjAgPz9cbiAgLy8gVE9ETyAtIG9wcG9zaXRlIGRpcmVjdGlvbj8gd2F0ZXJlcmZhbGwgY2F2ZSBpcyBhIHJpZ2h0L2Rvd24gbWF0Y2h1cC4uLlxufVxuXG4vKiogQHBhcmFtIHRpbGUgcG9zaXRpb24gb2YgbG93ZXItbGVmdCBtZXRhdGlsZSAoZS5nLiAweDQyIGZvciA0MF8zMCkuICovXG5leHBvcnQgZnVuY3Rpb24gdXBTdGFpcih0aWxlOiBudW1iZXIsIHdpZHRoID0gMik6IENvbm5lY3Rpb24ge1xuICAvLyBmcm9tIG1hcCAwNDogZW50cmFuY2UgNDBfMzAgID0+IGV4aXRzIDMyLDMzXG4gIC8vIGZyb20gbWFwIDE5IChzaW5nbGUtd2lkdGgpOiB0aWxlIDY4ID0+IGVudHJhbmNlIDc4Xzg4LCBleGl0IDY4XG4gIGNvbnN0IHkgPSB0aWxlID4+PiA0O1xuICBjb25zdCB4ID0gdGlsZSAmIDB4ZjtcbiAgaWYgKHdpZHRoID09PSAxKSB7XG4gICAgLy8gVE9ETyAtIHdoYXQgZG9lcyBpdCBtZWFuIGZvciBlbnRyYW5jZSB0byBiZSA+IDB4ZmZmZi4uLj9cbiAgICAvLyAgICAgIC0gc2NyZWVuIDZjIChvYWsgTlcpIGhhcyB0aGlzXG4gICAgY29uc3QgZHkgPSB5ID09PSAweGUgPyAweDI4MDAgOiAweDE4MDA7XG4gICAgY29uc3QgZW50cmFuY2UgPSAoKHkgPDwgMTIpICsgZHkpIHwgKCh4IDw8IDQpICsgMHgwMDA4KTtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ3N0YWlyOnVwJyxcbiAgICAgIGRpcjogMixcbiAgICAgIGVudHJhbmNlLFxuICAgICAgZXhpdHM6IFt0aWxlXSxcbiAgICB9O1xuICB9XG4gIC8vIFRPRE8gLSBpZiB5IGlzIDB4ZSB0aGVuIHdlIG1heSBuZWVkIHRvIGFkanVzdCBmb3Igc2NyZWVuIGVkZ2U/XG4gIGNvbnN0IGVudHJhbmNlID0geSA8PCAxMiB8ICgoeCA8PCA0KSArICh3aWR0aCA8PCAzKSk7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ3N0YWlyOnVwJyxcbiAgICBkaXI6IDAsXG4gICAgZW50cmFuY2UsXG4gICAgZXhpdHM6IHNlcSh3aWR0aCwgaSA9PiB0aWxlIC0gMHgxMCArIGkpLFxuICB9O1xufVxuXG4vKiogQHBhcmFtIHRpbGUgcG9zaXRpb24gb2YgdXBwZXItbGVmdCBtZXRhdGlsZSAoZS5nLiAweGEyIGZvciBhZl8zMCkuICovXG5leHBvcnQgZnVuY3Rpb24gZG93blN0YWlyKHRpbGU6IG51bWJlciwgd2lkdGggPSAyKTogQ29ubmVjdGlvbiB7XG4gIC8vIGZyb20gbWFwIDA1OiBlbnRyYW5jZSBhZl8zMCAgPT4gZXhpdHMgYjIsYjNcbiAgLy8gZnJvbSBtYXAgZDQgKHNpbmdsZS13aWR0aCk6IHRpbGUgNGMgPT4gZW50cmFuY2UgMzhfYzgsIGV4aXQgNGNcbiAgY29uc3QgeSA9IHRpbGUgPj4+IDQ7XG4gIGNvbnN0IHggPSB0aWxlICYgMHhmO1xuICBpZiAod2lkdGggPT09IDEpIHtcbiAgICBjb25zdCBlbnRyYW5jZSA9ICgoeSA8PCAxMikgLSAweDA4MDApIHwgKCh4IDw8IDQpICsgMHgwMDA4KTtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ3N0YWlyOmRvd24nLFxuICAgICAgZGlyOiAyLFxuICAgICAgZW50cmFuY2UsXG4gICAgICBleGl0czogW3RpbGVdLFxuICAgIH07XG4gIH1cbiAgY29uc3QgZW50cmFuY2UgPSB5IDw8IDEyIHwgMHgwZjAwIHwgKCh4IDw8IDQpICsgKHdpZHRoIDw8IDMpKTtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnc3RhaXI6ZG93bicsXG4gICAgZGlyOiAyLFxuICAgIGVudHJhbmNlLFxuICAgIGV4aXRzOiBzZXEod2lkdGgsIGkgPT4gdGlsZSArIDB4MTAgKyBpKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhdmUodGlsZTogbnVtYmVyLCB0eXBlOiBDb25uZWN0aW9uVHlwZSA9ICdjYXZlJyk6IENvbm5lY3Rpb24ge1xuICByZXR1cm4gey4uLnVwU3RhaXIodGlsZSArIDE2KSwgdHlwZX07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkb29yKHRpbGU6IG51bWJlciwgdHlwZTogQ29ubmVjdGlvblR5cGUgPSAnZG9vcicpOiBDb25uZWN0aW9uIHtcbiAgcmV0dXJuIHsuLi51cFN0YWlyKHRpbGUsIDEpLCB0eXBlfTtcbn1cblxuLyoqIEBwYXJhbSB0aWxlIGJvdHRvbS1sZWZ0IG1ldGF0aWxlICovXG5leHBvcnQgZnVuY3Rpb24gd2F0ZXJmYWxsQ2F2ZSh0aWxlOiBudW1iZXIpOiBDb25uZWN0aW9uIHtcbiAgY29uc3QgeSA9IHRpbGUgPj4+IDQ7XG4gIGNvbnN0IHggPSB0aWxlICYgMHhmO1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdjYXZlJyxcbiAgICBkaXI6IDAsXG4gICAgZW50cmFuY2U6IHkgPDwgMTIgfCB4IDw8IDQgfCAweGYsXG4gICAgZXhpdHM6IFt0aWxlIC0gMHhmLCB0aWxlICsgMV0sXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b3BFZGdlKHtsZWZ0ID0gNywgd2lkdGggPSAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgIHRvcCA9IDIsIG1hbnVhbCA9IGZhbHNlfSA9IHt9KTogQ29ubmVjdGlvbiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ2VkZ2U6dG9wJyxcbiAgICBtYW51YWwsXG4gICAgZGlyOiAwLFxuICAgIGVudHJhbmNlOiAoKHRvcCArIDEpIDw8IDEyKSB8ICgobGVmdCA8PCA0KSArICh3aWR0aCA8PCAzKSksXG4gICAgZXhpdHM6IHNlcSh3aWR0aCwgaSA9PiAodG9wIDw8IDQpIHwgKGkgKyBsZWZ0KSksXG4gIH07XG59XG5cbi8vIFRPRE8gLSBjb25zaWRlciBzZXBhcmF0aW5nIHdpZGUgdnMgbmFycm93IGVkZ2VzIGludG8gc2VwYXJhdGUgdHlwZXM/Pz9cblxuZXhwb3J0IGZ1bmN0aW9uIGJvdHRvbUVkZ2Uoe2xlZnQgPSA3LCB3aWR0aCA9IDIsIHNoaWZ0ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlID0gJ2VkZ2U6Ym90dG9tJyBhcyBDb25uZWN0aW9uVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYW51YWwgPSBmYWxzZX0gPSB7fSk6IENvbm5lY3Rpb24ge1xuICAvLyBOT1RFOiBzb21lIHNjcmVlbnMgY2FuIGJlIHVzZWQgYm90aCBpbiBub3JtYWwgbWFwcyBhbmQgaW4gc2luZ2xlLWhlaWdodFxuICAvLyBtYXBzLiAgV2hlbiB1c2VkIGluIHNpbmdsZS1oZWlnaHQsIHdlIG5lZWQgdG8gc3VidHJhY3QgMiBmcm9tIHRoZSBZIHRpbGVcbiAgLy8gY29vcmRpbmF0ZXMgb2YgdGhlIGVudHJhbmNlL2V4aXQsIGNsYW1waW5nIHRvIGJmIChlbnRyYW5jZSkgYW5kIGMgKGV4aXQpLlxuICByZXR1cm4ge1xuICAgIHR5cGUsIG1hbnVhbCxcbiAgICBkaXI6IDIsXG4gICAgZW50cmFuY2U6IDB4ZGZfMDAgfCAoKGxlZnQgPDwgNCkgKyAod2lkdGggPDwgMykgKyAxNiAqIHNoaWZ0KSxcbiAgICBleGl0czogc2VxKHdpZHRoLCBpID0+IDB4ZTAgfCAoaSArIGxlZnQpKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJvdHRvbUVkZ2VIb3VzZSh7bGVmdCA9IDcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aCA9IDIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGlmdCA9IDB9ID0ge30pOiBDb25uZWN0aW9uIHtcbiAgLy8gVW5saWtlIFwiZHVhbC1tb2RlXCIgc2NyZWVucywgaW5kb29ycy1vbmx5IHNjcmVlbnMgaGF2ZSB0aGVpciBlbnRyYW5jZSBhblxuICAvLyBhZGRpdGlvbmFsIHRpbGUgdXAsIGF0IGFmL2IuICBUaGlzIGhhcmQtY29kZXMgdGhhdC5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnZWRnZTpib3R0b20nLFxuICAgIGRpcjogMixcbiAgICBlbnRyYW5jZTogMHhhZl8wMCB8ICgobGVmdCA8PCA0KSArICh3aWR0aCA8PCAzKSArIDE2ICogc2hpZnQpLFxuICAgIGV4aXRzOiBzZXEod2lkdGgsIGkgPT4gMHhiMCB8IChpICsgbGVmdCkpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGVmdEVkZ2Uoe3RvcCA9IDcsIGhlaWdodCA9IDIsIHNoaWZ0ID0gMH0gPSB7fSk6IENvbm5lY3Rpb24ge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdlZGdlOmxlZnQnLFxuICAgIGRpcjogMSxcbiAgICBlbnRyYW5jZTogKCh0b3AgPDwgMTIpICsgKCgxNiAqIHNoaWZ0KSA8PCA4KSArIChoZWlnaHQgPDwgMTEpKSB8IDB4MTAsXG4gICAgZXhpdHM6IHNlcShoZWlnaHQsIGkgPT4gKGkgKyB0b3ApIDw8IDQpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmlnaHRFZGdlKHt0b3AgPSA3LCBoZWlnaHQgPSAyfSA9IHt9KTogQ29ubmVjdGlvbiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ2VkZ2U6cmlnaHQnLFxuICAgIGRpcjogMyxcbiAgICBlbnRyYW5jZTogKCh0b3AgPDwgMTIpICsgKGhlaWdodCA8PCAxMSkpIHwgMHhlZixcbiAgICBleGl0czogc2VxKGhlaWdodCwgaSA9PiAoaSArIHRvcCkgPDwgNCB8IDB4ZiksXG4gIH07XG59XG5cbi8qKiBAcGFyYW0gdGlsZSBUb3AtbGVmdCB0aWxlIG9mIHRyYW5zaXRpb24gKGhlaWdodCAyKSAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlYW1sZXNzVXAodGlsZTogbnVtYmVyLCB3aWR0aCA9IDIpOiBDb25uZWN0aW9uIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnc2VhbWxlc3M6dXAnLFxuICAgIGRpcjogMCxcbiAgICBnZXQgZW50cmFuY2UoKTogbnVtYmVyIHsgdGhyb3cgbmV3IEVycm9yKCdkb2VzIG5vdCBtYWtlIHNlbnNlJyk7IH0sXG4gICAgZXhpdHM6IHNlcSh3aWR0aCwgaSA9PiAodGlsZSArIGkpKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlYW1sZXNzRG93bih0aWxlOiBudW1iZXIsIHdpZHRoID0gMik6IENvbm5lY3Rpb24ge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdzZWFtbGVzczpkb3duJyxcbiAgICBkaXI6IDIsXG4gICAgZ2V0IGVudHJhbmNlKCk6IG51bWJlciB7IHRocm93IG5ldyBFcnJvcignZG9lcyBub3QgbWFrZSBzZW5zZScpOyB9LFxuICAgIGV4aXRzOiBzZXEod2lkdGgsIGkgPT4gKHRpbGUgKyBpKSksXG4gIH07XG59XG4iXX0=