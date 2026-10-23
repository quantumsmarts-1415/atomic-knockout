// Face squares for the damage-box portraits.
//
// assets/portraits/<id>.png is already cropped and centered on the face.
// portrait-crops.json records how that square was taken from the idle
// (source sheet, center, size, method). Draw the PNG so it fills the disc.
// Do not apply a second zoom on top of it.
import crops from '../../assets/portraits/portrait-crops.json' with { type: 'json' };

export const PORTRAIT_CROP_OVERRIDES = crops;

export function portraitCrop(id) {
  return PORTRAIT_CROP_OVERRIDES[id] || null;
}

export function portraitCropIds() {
  return Object.keys(PORTRAIT_CROP_OVERRIDES);
}

export function portraitFile(id) {
  return `assets/portraits/${id}.png`;
}

export function portraitTextureKey(id) {
  return `portrait-${id}`;
}

export function hasFacePortrait(id) {
  return !!PORTRAIT_CROP_OVERRIDES[id];
}
