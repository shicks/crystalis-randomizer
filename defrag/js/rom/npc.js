import { Entity } from './entity.js';
import { MessageId } from './messageid.js';
import { addr, readBigEndian, tuple } from './util.js';
export class Npc extends Entity {
    constructor(rom, id) {
        super(rom, id);
        this.localDialogs = new Map();
        this.used = !UNUSED_NPCS.has(id) && (id < 0x8f || id >= 0xc0);
        this.dataBase = 0x80f0 | ((id & 0xfc) << 6) | ((id & 3) << 2);
        this.data = tuple(rom.prg, this.dataBase, 4);
        this.spawnPointer = 0x1c5e0 + (id << 1);
        this.spawnBase = addr(rom.prg, this.spawnPointer, 0x14000);
        this.spawnConditions = new Map();
        let i = this.spawnBase;
        let loc;
        while (this.used && (loc = rom.prg[i++]) !== 0xff) {
            const flags = [];
            this.spawnConditions.set(loc, flags);
            let word;
            do {
                word = rom.prg[i] << 8 | rom.prg[i + 1];
                const flag = word & 0x0fff;
                flags.push(word & 0x2000 ? ~flag : flag);
                i += 2;
            } while (!(word & 0x8000));
        }
        this.dialogPointer = 0x1c95d + (id << 1);
        this.dialogBase = addr(rom.prg, this.dialogPointer, 0x14000);
        this.globalDialogs = [];
        let a = this.dialogBase;
        while (true) {
            const [dialog, last] = GlobalDialog.parse(rom.prg, a);
            a += 4;
            this.globalDialogs.push(dialog);
            if (last)
                break;
        }
        const locations = [];
        while (true) {
            const location = rom.prg[a++];
            if (location === 0xff)
                break;
            locations.push([location, rom.prg[a++]]);
        }
        if (!locations.length)
            locations.push([-1, 0]);
        const base = a;
        for (const [location, offset] of locations) {
            const dialogs = [];
            this.localDialogs.set(location, dialogs);
            a = base + offset;
            while (true) {
                const [dialog, last] = LocalDialog.parse(rom.prg, a);
                a += dialog.byteLength();
                dialogs.push(dialog);
                if (last)
                    break;
            }
        }
    }
    spawnConditionsBytes() {
        const bytes = [];
        for (const [loc, flags] of this.spawnConditions) {
            bytes.push(loc);
            for (let i = 0; i < flags.length; i++) {
                let word = flags[i];
                if (word < 0)
                    word = ~word | 0x2000;
                if (i === flags.length - 1)
                    word = word | 0x8000;
                bytes.push(word >>> 8, word & 0xff);
            }
        }
        bytes.push(0xff);
        return bytes;
    }
    async write(writer, { spawnConditionsBase = 0x1c5e0 } = {}) {
        const address = await writer.write(this.spawnConditionsBytes(), 0x1c000, 0x1dfff);
        writer.rom[spawnConditionsBase + 2 * this.id] = address & 0xff;
        writer.rom[spawnConditionsBase + 2 * this.id + 1] = (address >>> 8) - 0x40;
    }
}
export class GlobalDialog {
    constructor(condition, message) {
        this.condition = condition;
        this.message = message;
    }
    static parse(data, offset = 0) {
        const flag = readBigEndian(data, offset);
        const message = MessageId.from(data, offset + 2);
        let condition = flag & 0x03ff;
        const last = !!(flag & 0x8000);
        const sign = flag & 0x2000;
        if (sign)
            condition = ~condition;
        return [new GlobalDialog(condition, message), last];
    }
    bytes(last) {
        let flag = this.condition;
        if (flag < 0)
            flag = (~flag) | 0x2000;
        if (last)
            flag |= 0x8000;
        return [flag >>> 8, flag & 0xff, ...this.message.data];
    }
}
export class LocalDialog {
    constructor(condition, message, update, flags) {
        this.condition = condition;
        this.message = message;
        this.update = update;
        this.flags = flags;
    }
    static parse(data, offset = 0) {
        let word = readBigEndian(data, offset);
        const message = MessageId.from(data, offset + 2);
        const update = data[offset + 4];
        offset += 5;
        let condition = word & 0x03ff;
        const last = !!(word & 0x8000);
        const flags = [];
        const sign = word & 0x2000;
        if (sign)
            condition = ~condition;
        while (word & 0x4000) {
            word = readBigEndian(data, offset) ^ 0x4000;
            offset += 2;
            let flag = word & 0x03ff;
            if (word & 0x8000)
                flag = ~flag;
            flags.push(flag);
        }
        return [new LocalDialog(condition, message, update, flags), last];
    }
    byteLength() {
        return 5 + 2 * this.flags.length;
    }
    bytes(last) {
        let flag = this.condition;
        if (flag < 0)
            flag = (~flag) | 0x2000;
        if (last)
            flag |= 0x8000;
        if (this.flags.length)
            flag |= 0x4000;
        const out = [flag >>> 8, flag & 0xff, ...this.message.data, this.update];
        for (let i = 0; i < this.flags.length; i++) {
            let word = this.flags[i];
            if (i >= this.flags.length - 1)
                word |= 0x4000;
            if (word < 0)
                word = (~word) | 0x8000;
            out.push(word >>> 8, word & 0xff);
        }
        return out;
    }
}
const UNUSED_NPCS = new Set([
    0x3c, 0x6a, 0x73, 0x82, 0x86, 0x87, 0x89, 0x8a, 0x8b, 0x8c, 0x8d,
]);
//# sourceMappingURL=npc.js.map