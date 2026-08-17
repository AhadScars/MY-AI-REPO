/** Block type definitions for BlockCraft */

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  COBBLE: 8,
  PLANKS: 9,
};

export const BLOCK_META = {
  [BLOCK.AIR]: { name: "Air", solid: false, color: null, diggable: false },
  [BLOCK.GRASS]: {
    name: "Grass",
    solid: true,
    diggable: true,
    // top, side, bottom
    colors: [0x5d9b3a, 0x8b6914, 0x6b4423],
    drop: BLOCK.DIRT,
  },
  [BLOCK.DIRT]: {
    name: "Dirt",
    solid: true,
    diggable: true,
    colors: [0x6b4423, 0x6b4423, 0x6b4423],
    drop: BLOCK.DIRT,
  },
  [BLOCK.STONE]: {
    name: "Stone",
    solid: true,
    diggable: true,
    colors: [0x888888, 0x777777, 0x666666],
    drop: BLOCK.COBBLE,
  },
  [BLOCK.WOOD]: {
    name: "Wood",
    solid: true,
    diggable: true,
    colors: [0x6b5420, 0x8b6914, 0x6b5420],
    drop: BLOCK.WOOD,
  },
  [BLOCK.LEAVES]: {
    name: "Leaves",
    solid: true,
    diggable: true,
    colors: [0x3d8b37, 0x2e7d32, 0x388e3c],
    drop: BLOCK.LEAVES,
    transparent: true,
  },
  [BLOCK.SAND]: {
    name: "Sand",
    solid: true,
    diggable: true,
    colors: [0xe8d48b, 0xdbc978, 0xc9b86a],
    drop: BLOCK.SAND,
  },
  [BLOCK.WATER]: {
    name: "Water",
    solid: false,
    diggable: false,
    colors: [0x3a7ca5, 0x2e6a8f, 0x1e5a7a],
    transparent: true,
  },
  [BLOCK.COBBLE]: {
    name: "Cobble",
    solid: true,
    diggable: true,
    colors: [0x6a6a6a, 0x5a5a5a, 0x4a4a4a],
    drop: BLOCK.COBBLE,
  },
  [BLOCK.PLANKS]: {
    name: "Planks",
    solid: true,
    diggable: true,
    colors: [0xc4a35a, 0xb8954a, 0xa8843a],
    drop: BLOCK.PLANKS,
  },
};

/** Hotbar order — placeable blocks */
export const HOTBAR_BLOCKS = [
  BLOCK.DIRT,
  BLOCK.GRASS,
  BLOCK.STONE,
  BLOCK.COBBLE,
  BLOCK.WOOD,
  BLOCK.PLANKS,
  BLOCK.LEAVES,
  BLOCK.SAND,
];

export function isSolid(id) {
  return BLOCK_META[id]?.solid === true;
}

export function isDiggable(id) {
  return BLOCK_META[id]?.diggable === true;
}
