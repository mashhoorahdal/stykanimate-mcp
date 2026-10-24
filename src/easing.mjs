// The keyframe easing modes a spec can name, mapped to the editor's native easing metadata.
export const EASINGS = Object.freeze({
  auto: {interpolation: 'auto'},
  linear: {interpolation: 'linear'},
  'ease-in': {interpolation: 'ease-in'},
  'ease-out': {interpolation: 'ease-out'},
  'ease-in-out': {interpolation: 'bezier', bezier: [0.42, 0, 0.58, 1]},
  constant: {interpolation: 'constant'},
});
