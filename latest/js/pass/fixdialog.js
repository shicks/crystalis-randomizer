import { hex } from '../rom/util.js';
import { buildTradeInMap } from './shuffletrades.js';
import { fail } from '../assert.js';
export function fixDialog(rom) {
    replaceMessage('03:06', ',', '');
    const tradeIns = buildTradeInMap(rom);
    const zebu = rom.npcs[0x5e];
    if (zebu.data[0] < 0x41)
        unmagic('00:1b');
    replaceMessage('00:1b', '[41:Refresh]', item(zebu.data[0]));
    const akahanaTradeIn = mustGet(tradeIns, 0x82);
    replaceMessage('02:01', 'an unusual statue', vague(akahanaTradeIn));
    replaceMessage('02:02', 'a statue', `the ${commonNoun(akahanaTradeIn)}`);
    const gasMaskSlot = actionGrant(akahanaTradeIn);
    replaceMessage('02:02', '[29:Gas Mask]', item(gasMaskSlot));
    const telepathySlot = rom.prg[0x367f4];
    if (telepathySlot < 0x41)
        unmagic('03:01');
    replaceMessage('03:01', '[43:Telepathy]', item(telepathySlot));
    const tornel = rom.npcs[0x5f];
    const tornelTradeIn = findTornelTradeIn(tornel);
    replaceMessage('03:01', '[06:Tornado Bracelet]', item(tornelTradeIn));
    replaceMessage('05:0a', '[06:Tornado Bracelet]', item(tornelTradeIn));
    replaceMessage('05:0a', '[44:Teleport]', item(tornel.data[0]));
    const fogLampTradeIn = tradeIns.get(0x64);
    if (fogLampTradeIn != null) {
        replaceMessage('09:01', '[35:Fog Lamp]', item(fogLampTradeIn));
        replaceMessage('09:04', '[35:Fog Lamp]', item(fogLampTradeIn));
        replaceMessage('09:05', '[35:Fog Lamp]', item(fogLampTradeIn));
        replaceMessage('09:06', 'lamp', commonNoun(fogLampTradeIn));
    }
    const queen = rom.npcs[0x38];
    replaceMessage('0a:0c', '[28:Flute of Lime]', item(queen.data[0]));
    replaceMessage('0a:0d', '[02:Sword of Water]', item(queen.localDialogs.get(-1)[3].condition & 0xff));
    const recoverSlot = rom.prg[0x3d1f9];
    if (recoverSlot < 0x41)
        unmagic('0b:01');
    replaceMessage('0b:01', '[45:Recover]', item(recoverSlot));
    const barrierSlot = actionGrant(0x84);
    if (barrierSlot < 0x41) {
        unmagic('0b:01');
        unmagic('1d:12');
    }
    replaceMessage('0b:01', '[46:Barrier]', item(barrierSlot));
    replaceMessage('1d:12', '[46:Barrier]', item(barrierSlot));
    let fogLampCaveLoot = findLoot(0x4f, 0x4e, 0x4d, 0x4c, 0x47, 0x46, 0x45, 0x44, 0x4b, 0x4a, 0x49, 0x48);
    if (fogLampCaveLoot >= 0) {
        replaceMessage('0d:00', '[35:Fog Lamp]', item(fogLampCaveLoot));
    }
    else {
        replaceMessage('0d:00', 'that a [35:Fog Lamp] was', 'there was treasure');
    }
    const rageTradeIn = rom.npcs[0xc3].localDialogs.get(-1)[0].condition & 0xff;
    const rageItem = rom.prg[0x3d337];
    replaceMessage('0e:03', '[02:Sword of Water]', item(rageTradeIn));
    replaceMessage('0e:03', '[09:Ball of Water]', item(rageItem));
    replaceMessage('10:0c', 'that\'s', 'is');
    replaceMessage('10:0c', /, is in the\+lighthouse/, '');
    const aryllisTradeIn = tradeIns.get(0x23);
    if (aryllisTradeIn != null) {
        replaceMessage('12:05', '[3c:Kirisa Plant]', item(aryllisTradeIn));
        replaceMessage('12:10', 'the plant', `the ${commonNoun(aryllisTradeIn)}`);
        replaceMessage('12:10', '[3c:Kirisa Plant]', item(aryllisTradeIn));
        const clue = `Our illustrious chief seeks ${vague(aryllisTradeIn)}.`;
        replaceMessage('12:09', /[^]*/, clue);
        replaceMessage('12:0a', /[^]*/, clue);
    }
    const lovePendantTradeIn = mustGet(tradeIns, 0x74);
    replaceMessage('13:02', '[3b:Love Pendant]', item(lovePendantTradeIn));
    replaceMessage('13:00', 'pendant', commonNoun(lovePendantTradeIn));
    const changeSlot = actionGrant(lovePendantTradeIn);
    if (changeSlot < 0x41) {
        unmagic('13:02');
    }
    replaceMessage('13:02', '[47:Change]', item(changeSlot));
    const ivoryStatueTradeIn = tradeIns.get(0x75);
    if (ivoryStatueTradeIn != null) {
        replaceMessage('18:06', '[3d:Ivory Statue]', item(ivoryStatueTradeIn));
        replaceMessage('18:07', '[3d:Ivory Statue]', item(ivoryStatueTradeIn));
    }
    replaceMessage('18:06', `It's in a room`, '{0b:Karmine} is');
    const flightSlot = rom.prg[0x3d18f];
    if (flightSlot < 0x41)
        replaceMessage('18:07', 'teach', 'give');
    replaceMessage('18:07', '[48:Flight]', item(flightSlot));
    const paralysisSlot = actionGrant(0xb2);
    if (paralysisSlot < 0x41)
        unmagic('1c:10');
    replaceMessage('1c:10', '[42:Paralysis]', item(paralysisSlot));
    replaceMessage('20:06', 'Statue of Gold', item(actionGrant(0x39)));
    function unmagic(mid) {
        replaceMessage(mid, /teach\s+you\s+the\s+magic\s+of/, 'bestow upon you the');
    }
    function item(id) {
        const item = itemget(id);
        return `[${hex(item.id)}:${item.messageName}]`;
    }
    function replaceMessage(mid, pat, repl) {
        const [part, index] = mid.split(':').map(x => parseInt(x, 16));
        const msg = rom.messages.parts[part][index];
        msg.text = msg.text.replace(pat, repl);
    }
    function findLoot(...locs) {
        const conditions = [
            (item) => BOWS.has(item),
            (item) => SWORD_OR_MAGIC.has(item),
            (item) => itemget(item).unique,
        ];
        for (const cond of conditions) {
            for (const id of locs) {
                const loc = rom.locations[id];
                for (const spawn of loc.spawns) {
                    if (spawn.isChest() && spawn.id <= 0x48 && cond(spawn.id)) {
                        return spawn.id;
                    }
                }
            }
        }
        return -1;
    }
    function itemget(id) {
        const itemget = rom.itemGets[id];
        return rom.items[itemget.itemId];
    }
    function actionGrant(key) {
        const grant = rom.itemGets.actionGrants.get(key);
        if (grant == null)
            throw new Error(`Missing actionGrant for ${hex(key)}`);
        return grant;
    }
}
const BOWS = new Set([0x3e, 0x3f, 0x40]);
const SWORD_OR_MAGIC = new Set([0x00, 0x01, 0x02, 0x03, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48]);
function findTornelTradeIn(tornel) {
    for (const ds of tornel.localDialogs.values()) {
        for (let i = 2; i < ds.length; i++) {
            const item = ~ds[i].condition;
            if (item > 0x204 && item <= 0x20c && !(item & 1))
                return item & 0xff;
        }
    }
    return 0x06;
}
function vague(id) {
    switch (id) {
        case 0x25: return 'an unusual statue';
        case 0x28: return 'a rare instrument';
        case 0x35: return 'a brilliant lamp';
        case 0x3b: return 'a beautiful charm';
        case 0x3c: return 'a fragrant plant';
        case 0x3d: return 'an exotic statue';
    }
    fail();
    return 'a valuable item';
}
function commonNoun(id) {
    switch (id) {
        case 0x25: return 'statue';
        case 0x28: return 'instrument';
        case 0x35: return 'lamp';
        case 0x3b: return 'pendant';
        case 0x3c: return 'plant';
        case 0x3d: return 'statue';
    }
    fail();
    return 'item';
}
function mustGet(map, key) {
    const result = map.get(key);
    if (result == null)
        throw new Error(`Expected value for ${key}`);
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZGlhbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2pzL3Bhc3MvZml4ZGlhbG9nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUNuQyxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDbkQsT0FBTyxFQUFDLElBQUksRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUdsQyxNQUFNLFVBQVUsU0FBUyxDQUFDLEdBQVE7SUFFaEMsY0FBYyxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFakMsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBR3RDLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUk7UUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDMUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTVELE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDL0MsY0FBYyxDQUFDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUNwRSxjQUFjLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxPQUFPLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFekUsTUFBTSxXQUFXLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ2hELGNBQWMsQ0FBQyxPQUFPLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxXQUFX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dEMsS0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLG1CQUFtQixDQUFDO1FBQ3RDLEtBQUssSUFBSSxDQUFDLENBQUMsT0FBTyxrQkFBa0IsQ0FBQztRQUNyQyxLQUFLLElBQUksQ0FBQyxDQUFDLE9BQU8sbUJBQW1CLENBQUM7UUFDdEMsS0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLGtCQUFrQixDQUFDO1FBQ3JDLEtBQUssSUFBSSxDQUFDLENBQUMsT0FBTyxrQkFBa0IsQ0FBQztLQUN0QztJQUNELElBQUksRUFBRSxDQUFDO0lBQ1AsT0FBTyxpQkFBaUIsQ0FBQztBQUMzQixDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsRUFBVTtJQUM1QixRQUFRLEVBQUUsRUFBRTtRQUNWLEtBQUssSUFBSSxDQUFDLENBQUMsT0FBTyxRQUFRLENBQUM7UUFDM0IsS0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLFlBQVksQ0FBQztRQUMvQixLQUFLLElBQUksQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDO1FBQ3pCLEtBQUssSUFBSSxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUM7UUFDNUIsS0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQztRQUMxQixLQUFLLElBQUksQ0FBQyxDQUFDLE9BQU8sUUFBUSxDQUFDO0tBQzVCO0lBQ0QsSUFBSSxFQUFFLENBQUM7SUFDUCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQsU0FBUyxPQUFPLENBQU8sR0FBYyxFQUFFLEdBQU07SUFDM0MsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM1QixJQUFJLE1BQU0sSUFBSSxJQUFJO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNqRSxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtSb219IGZyb20gJy4uL3JvbS5qcyc7XG5pbXBvcnQge0l0ZW19IGZyb20gJy4uL3JvbS9pdGVtLmpzJztcbmltcG9ydCB7TnBjfSBmcm9tICcuLi9yb20vbnBjLmpzJztcbmltcG9ydCB7aGV4fSBmcm9tICcuLi9yb20vdXRpbC5qcyc7XG5pbXBvcnQge2J1aWxkVHJhZGVJbk1hcH0gZnJvbSAnLi9zaHVmZmxldHJhZGVzLmpzJztcbmltcG9ydCB7ZmFpbH0gZnJvbSAnLi4vYXNzZXJ0LmpzJztcblxuLyoqIEZpbmRzIHJlZmVyZW5jZXMgdG8gZ2l2ZW4gaXRlbXMgYW5kIHJlcGxhY2VzIGl0IHdpdGggdGhlIGFjdHVhbCBpdGVtcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaXhEaWFsb2cocm9tOiBSb20pIHtcbiAgLy8gU3RvbSdzIFwiSSdsbCwgYmUgd2FpdGluZy4uLlwiIGRpYWxvZyAtIHRoZSBjb21tYSBpcyBqdXN0IHdyb25nLlxuICByZXBsYWNlTWVzc2FnZSgnMDM6MDYnLCAnLCcsICcnKTtcblxuICBjb25zdCB0cmFkZUlucyA9IGJ1aWxkVHJhZGVJbk1hcChyb20pO1xuICAvLyBOT1RFOiB3ZSBuZWVkIHRvIGhhcmRjb2RlIG9yaWdpbmFsIG5hbWVzIGluIGNhc2UgdGhleSB3ZXJlIHNodWZmbGVkLlxuXG4gIGNvbnN0IHplYnUgPSByb20ubnBjc1sweDVlXTtcbiAgaWYgKHplYnUuZGF0YVswXSA8IDB4NDEpIHVubWFnaWMoJzAwOjFiJyk7XG4gIHJlcGxhY2VNZXNzYWdlKCcwMDoxYicsICdbNDE6UmVmcmVzaF0nLCBpdGVtKHplYnUuZGF0YVswXSkpO1xuXG4gIGNvbnN0IGFrYWhhbmFUcmFkZUluID0gbXVzdEdldCh0cmFkZUlucywgMHg4Mik7XG4gIHJlcGxhY2VNZXNzYWdlKCcwMjowMScsICdhbiB1bnVzdWFsIHN0YXR1ZScsIHZhZ3VlKGFrYWhhbmFUcmFkZUluKSk7XG4gIHJlcGxhY2VNZXNzYWdlKCcwMjowMicsICdhIHN0YXR1ZScsIGB0aGUgJHtjb21tb25Ob3VuKGFrYWhhbmFUcmFkZUluKX1gKTtcblxuICBjb25zdCBnYXNNYXNrU2xvdCA9IGFjdGlvbkdyYW50KGFrYWhhbmFUcmFkZUluKTsgLy8gb3BlbCBzdGF0dWVcbiAgcmVwbGFjZU1lc3NhZ2UoJzAyOjAyJywgJ1syOTpHYXMgTWFza10nLCBpdGVtKGdhc01hc2tTbG90KSk7XG5cbiAgY29uc3QgdGVsZXBhdGh5U2xvdCA9IHJvbS5wcmdbMHgzNjdmNF07XG4gIGlmICh0ZWxlcGF0aHlTbG90IDwgMHg0MSkgdW5tYWdpYygnMDM6MDEnKTtcbiAgcmVwbGFjZU1lc3NhZ2UoJzAzOjAxJywgJ1s0MzpUZWxlcGF0aHldJywgaXRlbSh0ZWxlcGF0aHlTbG90KSk7XG5cbiAgY29uc3QgdG9ybmVsID0gcm9tLm5wY3NbMHg1Zl07XG4gIGNvbnN0IHRvcm5lbFRyYWRlSW4gPSBmaW5kVG9ybmVsVHJhZGVJbih0b3JuZWwpO1xuICByZXBsYWNlTWVzc2FnZSgnMDM6MDEnLCAnWzA2OlRvcm5hZG8gQnJhY2VsZXRdJywgaXRlbSh0b3JuZWxUcmFkZUluKSk7XG4gIHJlcGxhY2VNZXNzYWdlKCcwNTowYScsICdbMDY6VG9ybmFkbyBCcmFjZWxldF0nLCBpdGVtKHRvcm5lbFRyYWRlSW4pKTtcbiAgcmVwbGFjZU1lc3NhZ2UoJzA1OjBhJywgJ1s0NDpUZWxlcG9ydF0nLCBpdGVtKHRvcm5lbC5kYXRhWzBdKSk7XG5cbiAgY29uc3QgZm9nTGFtcFRyYWRlSW4gPSB0cmFkZUlucy5nZXQoMHg2NCk7XG4gIGlmIChmb2dMYW1wVHJhZGVJbiAhPSBudWxsKSB7XG4gICAgcmVwbGFjZU1lc3NhZ2UoJzA5OjAxJywgJ1szNTpGb2cgTGFtcF0nLCBpdGVtKGZvZ0xhbXBUcmFkZUluKSk7XG4gICAgcmVwbGFjZU1lc3NhZ2UoJzA5OjA0JywgJ1szNTpGb2cgTGFtcF0nLCBpdGVtKGZvZ0xhbXBUcmFkZUluKSk7XG4gICAgcmVwbGFjZU1lc3NhZ2UoJzA5OjA1JywgJ1szNTpGb2cgTGFtcF0nLCBpdGVtKGZvZ0xhbXBUcmFkZUluKSk7XG4gICAgcmVwbGFjZU1lc3NhZ2UoJzA5OjA2JywgJ2xhbXAnLCBjb21tb25Ob3VuKGZvZ0xhbXBUcmFkZUluKSk7XG4gIH1cblxuICBjb25zdCBxdWVlbiA9IHJvbS5ucGNzWzB4MzhdO1xuICByZXBsYWNlTWVzc2FnZSgnMGE6MGMnLCAnWzI4OkZsdXRlIG9mIExpbWVdJywgaXRlbShxdWVlbi5kYXRhWzBdKSk7XG4gIHJlcGxhY2VNZXNzYWdlKCcwYTowZCcsICdbMDI6U3dvcmQgb2YgV2F0ZXJdJyxcbiAgICAgICAgICAgICAgICAgaXRlbShxdWVlbi5sb2NhbERpYWxvZ3MuZ2V0KC0xKSFbM10uY29uZGl0aW9uICYgMHhmZikpO1xuICAvLyBUT0RPIC0gY29uc2lkZXIgcmVwbGFjaW5nIDBhOjBkIGJ1dCB3ZSBuZWVkIHRvIGFsc28gcmVwbGFjZSBjb25kaXRpb24/XG4gIGNvbnN0IHJlY292ZXJTbG90ID0gcm9tLnByZ1sweDNkMWY5XTsgLy8gVE9ETyAtIGNvbnNvbGlkYXRlIGluIHRhYmxlP1xuICBpZiAocmVjb3ZlclNsb3QgPCAweDQxKSB1bm1hZ2ljKCcwYjowMScpO1xuICByZXBsYWNlTWVzc2FnZSgnMGI6MDEnLCAnWzQ1OlJlY292ZXJdJywgaXRlbShyZWNvdmVyU2xvdCkpO1xuXG4gIGNvbnN0IGJhcnJpZXJTbG90ID0gYWN0aW9uR3JhbnQoMHg4NCk7XG4gIGlmIChiYXJyaWVyU2xvdCA8IDB4NDEpIHtcbiAgICB1bm1hZ2ljKCcwYjowMScpO1xuICAgIHVubWFnaWMoJzFkOjEyJyk7XG4gIH1cbiAgcmVwbGFjZU1lc3NhZ2UoJzBiOjAxJywgJ1s0NjpCYXJyaWVyXScsIGl0ZW0oYmFycmllclNsb3QpKTtcbiAgcmVwbGFjZU1lc3NhZ2UoJzFkOjEyJywgJ1s0NjpCYXJyaWVyXScsIGl0ZW0oYmFycmllclNsb3QpKTtcblxuICAvLyBMb29rIGZvciBhIGtleSBpdGVtIGluIHRoZSBmb2cgbGFtcC9raXJpc2EgcGxhbnQgY2F2ZXMuXG4gIC8vIE9yZGVyIGlzIGJhY2sgb2YgZm9nIGxhbXAsIGtpcmlzYSBiYWNrLXRvLWZyb250LCB0aGVuIGZyb250IG9mIGZvZyBsYW1wXG4gIGxldCBmb2dMYW1wQ2F2ZUxvb3QgPSBmaW5kTG9vdCgweDRmLCAweDRlLCAweDRkLCAweDRjLCAweDQ3LCAweDQ2LCAweDQ1LCAweDQ0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMHg0YiwgMHg0YSwgMHg0OSwgMHg0OCk7XG4gIGlmIChmb2dMYW1wQ2F2ZUxvb3QgPj0gMCkge1xuICAgIHJlcGxhY2VNZXNzYWdlKCcwZDowMCcsICdbMzU6Rm9nIExhbXBdJywgaXRlbShmb2dMYW1wQ2F2ZUxvb3QpKTtcbiAgfSBlbHNlIHtcbiAgICByZXBsYWNlTWVzc2FnZSgnMGQ6MDAnLCAndGhhdCBhIFszNTpGb2cgTGFtcF0gd2FzJywgJ3RoZXJlIHdhcyB0cmVhc3VyZScpO1xuICB9XG5cbiAgY29uc3QgcmFnZVRyYWRlSW4gPSByb20ubnBjc1sweGMzXS5sb2NhbERpYWxvZ3MuZ2V0KC0xKSFbMF0uY29uZGl0aW9uICYgMHhmZjtcbiAgY29uc3QgcmFnZUl0ZW0gPSByb20ucHJnWzB4M2QzMzddO1xuICByZXBsYWNlTWVzc2FnZSgnMGU6MDMnLCAnWzAyOlN3b3JkIG9mIFdhdGVyXScsIGl0ZW0ocmFnZVRyYWRlSW4pKTtcbiAgcmVwbGFjZU1lc3NhZ2UoJzBlOjAzJywgJ1swOTpCYWxsIG9mIFdhdGVyXScsIGl0ZW0ocmFnZUl0ZW0pKTtcblxuICAvLyBUT0RPIC0gbWVzc2FnZSAxMDowYyBpcyBvbmx5IGhhbGYtY29ycmVjdC4gIElmIGl0ZW0gbmFtZXMgYXJlIHJhbmRvbWl6ZWRcbiAgLy8gdGhlbiBldmVuIHdpdGhvdXQgYSBsb2NhdGlvbiB0aGUgbWVzc2FnZSBpcyBzdGlsbCB1c2VmdWwuICBTbyBqdXN0IGRvIHRoYXRcbiAgLy8gZm9yIG5vdywgYW5kIHdlIGNhbiBmaW5kIGEgd2F5IHRvIGhpbnQgbGF0ZXIuXG4gIHJlcGxhY2VNZXNzYWdlKCcxMDowYycsICd0aGF0XFwncycsICdpcycpO1xuICByZXBsYWNlTWVzc2FnZSgnMTA6MGMnLCAvLCBpcyBpbiB0aGVcXCtsaWdodGhvdXNlLywgJycpO1xuXG4gIGNvbnN0IGFyeWxsaXNUcmFkZUluID0gdHJhZGVJbnMuZ2V0KDB4MjMpO1xuICBpZiAoYXJ5bGxpc1RyYWRlSW4gIT0gbnVsbCkge1xuICAgIHJlcGxhY2VNZXNzYWdlKCcxMjowNScsICdbM2M6S2lyaXNhIFBsYW50XScsIGl0ZW0oYXJ5bGxpc1RyYWRlSW4pKTtcbiAgICByZXBsYWNlTWVzc2FnZSgnMTI6MTAnLCAndGhlIHBsYW50JywgYHRoZSAke2NvbW1vbk5vdW4oYXJ5bGxpc1RyYWRlSW4pfWApO1xuICAgIHJlcGxhY2VNZXNzYWdlKCcxMjoxMCcsICdbM2M6S2lyaXNhIFBsYW50XScsIGl0ZW0oYXJ5bGxpc1RyYWRlSW4pKTtcbiAgICAvLyBUT0RPIC0gcmVmcyBpbiAxMjowOSBhbmQgMTI6MGEgaGF2ZSBsb2NhdGlvbiwgdG9vLlxuICAgIC8vIHJlcGxhY2VNZXNzYWdlKCcxMjowOScsIC9cXHMqXFxuLiovLCAnLicpO1xuICAgIC8vIHJlcGxhY2VNZXNzYWdlKCcxMjowYScsIC9cXHMqXFxuLiovLCAnLicpO1xuICAgIGNvbnN0IGNsdWUgPSBgT3VyIGlsbHVzdHJpb3VzIGNoaWVmIHNlZWtzICR7dmFndWUoYXJ5bGxpc1RyYWRlSW4pfS5gO1xuICAgIHJlcGxhY2VNZXNzYWdlKCcxMjowOScsIC9bXl0qLywgY2x1ZSk7XG4gICAgcmVwbGFjZU1lc3NhZ2UoJzEyOjBhJywgL1teXSovLCBjbHVlKTtcbiAgfVxuXG4gIGNvbnN0IGxvdmVQZW5kYW50VHJhZGVJbiA9IG11c3RHZXQodHJhZGVJbnMsIDB4NzQpO1xuICByZXBsYWNlTWVzc2FnZSgnMTM6MDInLCAnWzNiOkxvdmUgUGVuZGFudF0nLCBpdGVtKGxvdmVQZW5kYW50VHJhZGVJbikpO1xuICByZXBsYWNlTWVzc2FnZSgnMTM6MDAnLCAncGVuZGFudCcsIGNvbW1vbk5vdW4obG92ZVBlbmRhbnRUcmFkZUluKSk7XG4gIGNvbnN0IGNoYW5nZVNsb3QgPSBhY3Rpb25HcmFudChsb3ZlUGVuZGFudFRyYWRlSW4pO1xuICBpZiAoY2hhbmdlU2xvdCA8IDB4NDEpIHtcbiAgICB1bm1hZ2ljKCcxMzowMicpO1xuICB9XG4gIHJlcGxhY2VNZXNzYWdlKCcxMzowMicsICdbNDc6Q2hhbmdlXScsIGl0ZW0oY2hhbmdlU2xvdCkpO1xuXG4gIGNvbnN0IGl2b3J5U3RhdHVlVHJhZGVJbiA9IHRyYWRlSW5zLmdldCgweDc1KTtcbiAgaWYgKGl2b3J5U3RhdHVlVHJhZGVJbiAhPSBudWxsKSB7XG4gICAgcmVwbGFjZU1lc3NhZ2UoJzE4OjA2JywgJ1szZDpJdm9yeSBTdGF0dWVdJywgaXRlbShpdm9yeVN0YXR1ZVRyYWRlSW4pKTtcbiAgICByZXBsYWNlTWVzc2FnZSgnMTg6MDcnLCAnWzNkOkl2b3J5IFN0YXR1ZV0nLCBpdGVtKGl2b3J5U3RhdHVlVHJhZGVJbikpO1xuICB9XG4gIHJlcGxhY2VNZXNzYWdlKCcxODowNicsIGBJdCdzIGluIGEgcm9vbWAsICd7MGI6S2FybWluZX0gaXMnKTtcbiAgY29uc3QgZmxpZ2h0U2xvdCA9IHJvbS5wcmdbMHgzZDE4Zl07IC8vIFRPRE8gLSBjb25zb2xpZGF0ZT9cbiAgaWYgKGZsaWdodFNsb3QgPCAweDQxKSByZXBsYWNlTWVzc2FnZSgnMTg6MDcnLCAndGVhY2gnLCAnZ2l2ZScpO1xuICByZXBsYWNlTWVzc2FnZSgnMTg6MDcnLCAnWzQ4OkZsaWdodF0nLCBpdGVtKGZsaWdodFNsb3QpKTtcblxuICBjb25zdCBwYXJhbHlzaXNTbG90ID0gYWN0aW9uR3JhbnQoMHhiMik7XG4gIGlmIChwYXJhbHlzaXNTbG90IDwgMHg0MSkgdW5tYWdpYygnMWM6MTAnKTtcbiAgcmVwbGFjZU1lc3NhZ2UoJzFjOjEwJywgJ1s0MjpQYXJhbHlzaXNdJywgaXRlbShwYXJhbHlzaXNTbG90KSk7XG5cbiAgLy8gVE9ETyAtIHNodWZmbGUgd2hpY2ggaXRlbSByZWNvbnN0cnVjdHMgd2hpY2ggb3RoZXI/XG4gIHJlcGxhY2VNZXNzYWdlKCcyMDowNicsICdTdGF0dWUgb2YgR29sZCcsIGl0ZW0oYWN0aW9uR3JhbnQoMHgzOSkpKTtcblxuICAvLyBUT0RPIC0gY29uc2lkZXIgd2FycGluZyBvbiBhIHJhbmRvbSBzd29yZD8gLSBtZXNzYWdlIDFjOjExXG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gIGZ1bmN0aW9uIHVubWFnaWMobWlkOiBzdHJpbmcpIHtcbiAgICByZXBsYWNlTWVzc2FnZShtaWQsIC90ZWFjaFxccyt5b3VcXHMrdGhlXFxzK21hZ2ljXFxzK29mLywgJ2Jlc3RvdyB1cG9uIHlvdSB0aGUnKTtcbiAgfVxuICBmdW5jdGlvbiBpdGVtKGlkOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IGl0ZW0gPSBpdGVtZ2V0KGlkKTtcbiAgICByZXR1cm4gYFske2hleChpdGVtLmlkKX06JHtpdGVtLm1lc3NhZ2VOYW1lfV1gO1xuICB9XG4gIGZ1bmN0aW9uIHJlcGxhY2VNZXNzYWdlKG1pZDogc3RyaW5nLCBwYXQ6IHN0cmluZyB8IFJlZ0V4cCwgcmVwbDogc3RyaW5nKSB7XG4gICAgY29uc3QgW3BhcnQsIGluZGV4XSA9IG1pZC5zcGxpdCgnOicpLm1hcCh4ID0+IHBhcnNlSW50KHgsIDE2KSk7XG4gICAgY29uc3QgbXNnID0gcm9tLm1lc3NhZ2VzLnBhcnRzW3BhcnRdW2luZGV4XTtcbiAgICBtc2cudGV4dCA9IG1zZy50ZXh0LnJlcGxhY2UocGF0LCByZXBsKTtcbiAgfVxuICBmdW5jdGlvbiBmaW5kTG9vdCguLi5sb2NzOiBudW1iZXJbXSkge1xuICAgIGNvbnN0IGNvbmRpdGlvbnMgPSBbXG4gICAgICAoaXRlbTogbnVtYmVyKSA9PiBCT1dTLmhhcyhpdGVtKSxcbiAgICAgIChpdGVtOiBudW1iZXIpID0+IFNXT1JEX09SX01BR0lDLmhhcyhpdGVtKSxcbiAgICAgIChpdGVtOiBudW1iZXIpID0+IGl0ZW1nZXQoaXRlbSkudW5pcXVlLFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IGNvbmQgb2YgY29uZGl0aW9ucykge1xuICAgICAgZm9yIChjb25zdCBpZCBvZiBsb2NzKSB7XG4gICAgICAgIGNvbnN0IGxvYyA9IHJvbS5sb2NhdGlvbnNbaWRdO1xuICAgICAgICBmb3IgKGNvbnN0IHNwYXduIG9mIGxvYy5zcGF3bnMpIHtcbiAgICAgICAgICBpZiAoc3Bhd24uaXNDaGVzdCgpICYmIHNwYXduLmlkIDw9IDB4NDggJiYgY29uZChzcGF3bi5pZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBzcGF3bi5pZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG4gIGZ1bmN0aW9uIGl0ZW1nZXQoaWQ6IG51bWJlcik6IEl0ZW0ge1xuICAgIGNvbnN0IGl0ZW1nZXQgPSByb20uaXRlbUdldHNbaWRdO1xuICAgIHJldHVybiByb20uaXRlbXNbaXRlbWdldC5pdGVtSWRdO1xuICB9XG4gIGZ1bmN0aW9uIGFjdGlvbkdyYW50KGtleTogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBncmFudCA9IHJvbS5pdGVtR2V0cy5hY3Rpb25HcmFudHMuZ2V0KGtleSk7XG4gICAgaWYgKGdyYW50ID09IG51bGwpIHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBhY3Rpb25HcmFudCBmb3IgJHtoZXgoa2V5KX1gKTtcbiAgICByZXR1cm4gZ3JhbnQ7XG4gIH1cbn1cblxuY29uc3QgQk9XUyA9IG5ldyBTZXQoWzB4M2UsIDB4M2YsIDB4NDBdKTtcbmNvbnN0IFNXT1JEX09SX01BR0lDID0gbmV3IFNldChbMHgwMCwgMHgwMSwgMHgwMiwgMHgwMywgMHg0MSwgMHg0MiwgMHg0MywgMHg0NCwgMHg0NSwgMHg0NiwgMHg0NywgMHg0OF0pO1xuXG5mdW5jdGlvbiBmaW5kVG9ybmVsVHJhZGVJbih0b3JuZWw6IE5wYyk6IG51bWJlciB7XG4gIC8vIEV4cGVjdGVkIHN0cnVjdHVyZTpcbiAgLy8gICAuLi5cbiAgLy8gICBOT1QgYnJhY2VsZXQgLT4gLi4uXG4gIC8vICAgTk9UIGJhbGwgLT4gLi4uXG4gIC8vICAgLT4gZ2l2ZSBpdGVtXG4gIGZvciAoY29uc3QgZHMgb2YgdG9ybmVsLmxvY2FsRGlhbG9ncy52YWx1ZXMoKSkge1xuICAgIGZvciAobGV0IGkgPSAyOyBpIDwgZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB+ZHNbaV0uY29uZGl0aW9uO1xuICAgICAgLy8gTG9vayBmb3IgYW55IG5lZ2F0aXZlIGNvbmRpdGlvbiBvbiBhIGJyYWNlbGV0IChkb2Vzbid0IG1hdHRlciB3aGVyZSlcbiAgICAgIGlmIChpdGVtID4gMHgyMDQgJiYgaXRlbSA8PSAweDIwYyAmJiAhKGl0ZW0gJiAxKSkgcmV0dXJuIGl0ZW0gJiAweGZmO1xuICAgIH1cbiAgfVxuICByZXR1cm4gMHgwNjsgLy8gZGVmYXVsdCB0byB0b3JuYWRvIGJyYWNlbGV0XG59XG5cbmZ1bmN0aW9uIHZhZ3VlKGlkOiBudW1iZXIpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGlkKSB7XG4gICAgY2FzZSAweDI1OiByZXR1cm4gJ2FuIHVudXN1YWwgc3RhdHVlJztcbiAgICBjYXNlIDB4Mjg6IHJldHVybiAnYSByYXJlIGluc3RydW1lbnQnO1xuICAgIGNhc2UgMHgzNTogcmV0dXJuICdhIGJyaWxsaWFudCBsYW1wJztcbiAgICBjYXNlIDB4M2I6IHJldHVybiAnYSBiZWF1dGlmdWwgY2hhcm0nO1xuICAgIGNhc2UgMHgzYzogcmV0dXJuICdhIGZyYWdyYW50IHBsYW50JztcbiAgICBjYXNlIDB4M2Q6IHJldHVybiAnYW4gZXhvdGljIHN0YXR1ZSc7XG4gIH1cbiAgZmFpbCgpO1xuICByZXR1cm4gJ2EgdmFsdWFibGUgaXRlbSc7XG59XG5cbmZ1bmN0aW9uIGNvbW1vbk5vdW4oaWQ6IG51bWJlcik6IHN0cmluZyB7XG4gIHN3aXRjaCAoaWQpIHtcbiAgICBjYXNlIDB4MjU6IHJldHVybiAnc3RhdHVlJztcbiAgICBjYXNlIDB4Mjg6IHJldHVybiAnaW5zdHJ1bWVudCc7XG4gICAgY2FzZSAweDM1OiByZXR1cm4gJ2xhbXAnO1xuICAgIGNhc2UgMHgzYjogcmV0dXJuICdwZW5kYW50JztcbiAgICBjYXNlIDB4M2M6IHJldHVybiAncGxhbnQnO1xuICAgIGNhc2UgMHgzZDogcmV0dXJuICdzdGF0dWUnO1xuICB9XG4gIGZhaWwoKTtcbiAgcmV0dXJuICdpdGVtJztcbn1cblxuZnVuY3Rpb24gbXVzdEdldDxLLCBWPihtYXA6IE1hcDxLLCBWPiwga2V5OiBLKTogViB7XG4gIGNvbnN0IHJlc3VsdCA9IG1hcC5nZXQoa2V5KTtcbiAgaWYgKHJlc3VsdCA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIHZhbHVlIGZvciAke2tleX1gKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gZnVuY3Rpb24gcmVwbGFjZURpYWxvZyhucGM6IE5wYywgb3JpZzogbnVtYmVyIHwgUmVnRXhwLCByZXBsYWNlbWVudElkOiBudW1iZXIpIHtcbi8vICAgY29uc3Qgcm9tID0gbnBjLnJvbTtcbi8vICAgY29uc3QgcGF0ID0gb3JpZyBpbnN0YW5jZW9mIFJlZ0V4cCA/IG9yaWcgOiBwYXR0ZXJuKHJvbS5pdGVtc1tvcmlnXSk7XG4vLyAgIGNvbnN0IHJlcGwgPSByZXBsYWNlbWVudChyb20uaXRlbXNbcmVwbGFjZW1lbnRJZF0pO1xuLy8gICBmb3IgKGNvbnN0IGRzIG9mIG5wYy5sb2NhbERpYWxvZ3MudmFsdWVzKCkpIHtcbi8vICAgICBmb3IgKGNvbnN0IGQgb2YgZHMpIHtcbi8vICAgICAgIGNvbnN0IG1pZCA9IGQubWVzc2FnZTtcbi8vICAgICAgIHJlcGxhY2VNZXNzYWdlKHJvbSwgbWlkLnBhcnQsIG1pZC5pbmRleCwgcGF0LCByZXBsKTtcbi8vICAgICB9XG4vLyAgIH1cbi8vIH1cblxuLy8gY29uc3QgcGF0dGVybjogeyhpZDogbnVtYmVyLCBuYW1lOiBzdHJpbmcpOiBSZWdFeHA7XG4vLyAgICAgICAgICAgICAgICAgKGl0ZW06IEl0ZW0pOiBSZWdFeHB9ID1cbi8vICAgICAoaXRlbTogbnVtYmVyIHwgSXRlbSwgbmFtZT86IHN0cmluZykgPT4ge1xuLy8gICAgICAgbmFtZSA9IG5hbWUgfHwgKGl0ZW0gYXMgSXRlbSkubWVzc2FnZU5hbWU7XG4vLyAgICAgICBjb25zdCBpZCA9IGhleChpdGVtIGluc3RhbmNlb2YgSXRlbSA/IGl0ZW0uaWQgOiBpdGVtKTtcbi8vICAgICAgIHJldHVybiBuZXcgUmVnRXhwKGBcXFxcWyR7aWR9OlteXFxcXF1dKlxcXFxdfCR7bmFtZS5yZXBsYWNlKC9cXHMrL2csICdcXFxccysnKX1gLFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgJ2cnKTtcbi8vICAgICB9O1xuXG4vLyBmdW5jdGlvbiByZXBsYWNlbWVudChpdGVtOiBJdGVtKTogc3RyaW5nIHtcbi8vICAgcmV0dXJuIGBbJHtoZXgoaXRlbS5pZCl9OiR7aXRlbS5tZXNzYWdlTmFtZX1dYDtcbi8vIH1cbiJdfQ==