import {FlagSet} from '../flagset.js';
import {Random} from '../random.js';
import {Rom} from '../rom.js';

const KEY_NAMES = [
  'Curious Key',
  'Bronze Key',
  'Silver Key',
  'Ancient Key',
  'Small Key',
  'Shiny Key',
  'Mysterious Key',
  'Magic Key',
  'Piano Key',
  'Encryption Key',
  'Private Key',
  'Public Key',
  'Key Card',
  'Any Key',
  'Space Bar',
  'Return Key',
  'Backdoor Key',
  'Imaginary Key',
  'Giant Key',
  'Out of Key',
  'Key of C',
  'Key of G',
  'Key of B Flat',
  'Key of F Sharp',
  'Skeleton Key',
  'Golden Key',
  'Lockpick',
  'Transponder Key',
  'Sharp Key',
  'Flat Key',
  'Locke and Key',
  'Major Key',
  'Minor Key',
  'Cookie',
  'Turkey',
  'Monkey',
  'Ctrl Key',
  'Escape Key',
  'Car Key',
  'Clock Key',
  'Florida Key',
  'Key Lime Pie',
];
const FLUTE_NAMES = [
  'Wooden Flute',
  'Metal Flute',
  'Horn of Plenty',
  'Ocarina',
  'Pan Pipes',
  'Bugle',
  'Bagpipes',
  'Kazoo',
  'Tin Whistle',
  'Magic Whistle',
  'Dog Whistle',
  'Recorder',
  'Accordion',
  'Harmonica',
  'Sousaphone',
  'Trombone',
  'Violin',
  'Cello',
  'Theramin',
];
const LAMP_NAMES = [
  'Bronze Lamp',
  'Magic Lamp',
  'Dull Lamp',
  'Shimmering Lamp',
  'Oil Lamp',
  'Broken Lamp',
  'Frog Lamp',
  'Smog Lamp',
  'Dog Lamp',
  'Pog Champ',
  'Brass Lantern',
  'Candelabra',
];
const STATUE_NAMES = [
  'Rusty Statue',
  'Forbidden Statue',
  'Golden Idol',
  'Strange Statue',
  'Glass Statue',
  'Burt Figurine',
  'Draygon Figurine',
  'Karmine Figurine',
  'Mado Figurine',
  'Sabera Figurine',
  'Kelbesque Figurine',
  'Copper Statue',
  'White Statue',
  'Invisible Statue',
  'Mattrick Figurine',
  'Dragondarch Statue',
  'Overswarm Statue',
  'Trueblue83 Statue',
  'TheAxeMan Idol',
  'Acmlm Figurine',
  'Flail Guy Trophy',
  'Metroid Amiibo',
  'Model of Dyna',
];


export function unidentifiedItems(rom: Rom, flags: FlagSet, random: Random) {
  if (!flags.unidentifiedItems()) return;
  const items = (...ids: number[]) => ids.map(id => rom.items[id]);
  const keys = items(0x32, 0x33, 0x34);
  const flutes = items(0x27, 0x28, 0x31, 0x36);
  const lamps = items(0x35, 0x39);
  const statues = items(0x25, /* opel 0x26, */ 0x38, 0x3a, 0x3d);

  for (const [list, [...names]] of [[keys, KEY_NAMES],
                                    [flutes, FLUTE_NAMES],
                                    [lamps, LAMP_NAMES],
                                    [statues, STATUE_NAMES]] as const) {
    // palettes are :03 bit of item.itemDataValue
    random.shuffle(names);
    const palettes = random.shuffle([0, 1, 2, 3]);
    for (const item of list) {
      const name = names.pop()!;
      if (rom.spoiler) rom.spoiler.addUnidentifiedItem(item.id, item.messageName, name);
      item.menuName = item.messageName = name;
      item.palette = palettes.pop()!;
    }
  }
}
