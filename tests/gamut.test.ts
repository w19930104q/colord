import { colord, Colord, extend } from "../src/";
import labPlugin from "../src/plugins/lab";
import lchPlugin from "../src/plugins/lch";
import oklabPlugin from "../src/plugins/oklab";
import oklchPlugin from "../src/plugins/oklch";

extend([labPlugin, lchPlugin, oklabPlugin, oklchPlugin]);

/**
 * Reference conversions, ported from the CSS Color Module Level 4 sample code.
 * https://www.w3.org/TR/css-color-4/#color-conversion-code
 *
 * Deliberately independent of src/: the sRGB↔XYZ and Bradford matrices below are
 * the spec's own constants (the library carries its own), and the OKLab path goes
 * through XYZ→LMS instead of the library's composed linear-sRGB→LMS matrices,
 * so a constant typo on either side shows up here instead of canceling out.
 */
type Vec3 = [number, number, number];

const REF_D50: Vec3 = [0.96422, 1, 0.82521];
const REF_EPSILON = 216 / 24389;
const REF_KAPPA = 24389 / 27;

const REF_LIN_SRGB_TO_XYZ = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.119194779794626, 0.9505321522496607],
];
const REF_XYZ_TO_LIN_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const REF_D65_TO_D50 = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.00924308215252784, 0.015055144896577895, 0.7518742814281371],
];
const REF_D50_TO_D65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028289706955208394, 1.0099954580058226, 0.02104139819194309],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];
const REF_XYZ_TO_LMS = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const REF_LMS_TO_OKLAB = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const REF_OKLAB_TO_LMS = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const REF_LMS_TO_XYZ = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];

const matVecMul = (m: number[][], v: Vec3): Vec3 =>
  m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3;

const refLinearize = (byte: number): number => {
  const c = byte / 255;
  return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const refDelinearize = (linear: number): number =>
  (linear > 0.0031308 ? 1.055 * Math.pow(linear, 1 / 2.4) - 0.055 : 12.92 * linear) * 255;

const refRgbToXyzD65 = (r: number, g: number, b: number): Vec3 =>
  matVecMul(REF_LIN_SRGB_TO_XYZ, [refLinearize(r), refLinearize(g), refLinearize(b)]);

const refXyzD65ToRgb = (xyz: Vec3): Vec3 => {
  const linear = matVecMul(REF_XYZ_TO_LIN_SRGB, xyz);
  return [refDelinearize(linear[0]), refDelinearize(linear[1]), refDelinearize(linear[2])];
};

const refXyzToLab = (xyzD50: Vec3): Vec3 => {
  const f = xyzD50.map((v, i) => {
    const c = v / REF_D50[i];
    return c > REF_EPSILON ? Math.cbrt(c) : (REF_KAPPA * c + 16) / 116;
  });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
};

const refLabToXyz = (lab: Vec3): Vec3 => {
  const fy = (lab[0] + 16) / 116;
  const fx = lab[1] / 500 + fy;
  const fz = fy - lab[2] / 200;
  const expand = (f: number) =>
    Math.pow(f, 3) > REF_EPSILON ? Math.pow(f, 3) : (116 * f - 16) / REF_KAPPA;
  return [
    expand(fx) * REF_D50[0],
    (lab[0] > REF_KAPPA * REF_EPSILON ? Math.pow(fy, 3) : lab[0] / REF_KAPPA) * REF_D50[1],
    expand(fz) * REF_D50[2],
  ];
};

const refRgbToLab = (r: number, g: number, b: number): Vec3 =>
  refXyzToLab(matVecMul(REF_D65_TO_D50, refRgbToXyzD65(r, g, b)));

const refLabToRgb = (lab: Vec3): Vec3 =>
  refXyzD65ToRgb(matVecMul(REF_D50_TO_D65, refLabToXyz(lab)));

const refRgbToOklab = (r: number, g: number, b: number): Vec3 => {
  const lms = matVecMul(REF_XYZ_TO_LMS, refRgbToXyzD65(r, g, b));
  return matVecMul(REF_LMS_TO_OKLAB, lms.map(Math.cbrt) as Vec3);
};

const refOklabToRgb = (oklab: Vec3): Vec3 => {
  const lms = matVecMul(REF_OKLAB_TO_LMS, oklab);
  const xyz = matVecMul(REF_LMS_TO_XYZ, lms.map((c) => c ** 3) as Vec3);
  return refXyzD65ToRgb(xyz);
};

const toPolar = (lab: Vec3): Vec3 => {
  const hue = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return [lab[0], Math.sqrt(lab[1] ** 2 + lab[2] ** 2), hue < 0 ? hue + 360 : hue];
};

const toRectangular = (lch: Vec3): Vec3 => [
  lch[0],
  lch[1] * Math.cos((lch[2] * Math.PI) / 180),
  lch[1] * Math.sin((lch[2] * Math.PI) / 180),
];

const hexToRgb = (hex: string): Vec3 => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const clipByte = (value: number): number => Math.min(255, Math.max(0, Math.round(value)));

/** One row of the color-value matrix per CSS Color 4 space */
interface Space {
  name: string;
  toAxes: (color: Colord) => Vec3;
  fromAxes: (axes: Vec3, alpha: number) => Colord;
  alphaOf: (color: Colord) => number;
  toCss: (color: Colord) => string;
  refForward: (r: number, g: number, b: number) => Vec3;
  refBackward: (axes: Vec3) => Vec3;
  polar: boolean;
  axisTol: number;
  hueTol: number;
  /** Hue is only compared when the reference chroma clears this (it is unstable near 0) */
  minChromaForHue: number;
  roundtripTol: number;
}

const SPACES: Space[] = [
  {
    name: "lab",
    toAxes: (c) => {
      const { l, a, b } = c.toLab();
      return [l, a, b];
    },
    fromAxes: ([l, a, b], alpha) => colord({ l, a, b, alpha }),
    alphaOf: (c) => c.toLab().alpha,
    toCss: (c) => c.toLabString(),
    refForward: refRgbToLab,
    refBackward: refLabToRgb,
    polar: false,
    axisTol: 0.05,
    hueTol: 0,
    minChromaForHue: 0,
    roundtripTol: 1,
  },
  {
    name: "lch",
    toAxes: (c) => {
      const { l, c: chroma, h } = c.toLch();
      return [l, chroma, h];
    },
    fromAxes: ([l, c, h], a) => colord({ l, c, h, a }),
    alphaOf: (c) => c.toLch().a,
    toCss: (c) => c.toLchString(),
    refForward: (r, g, b) => toPolar(refRgbToLab(r, g, b)),
    refBackward: (lch) => refLabToRgb(toRectangular(lch)),
    polar: true,
    axisTol: 0.05,
    hueTol: 0.5,
    minChromaForHue: 5,
    roundtripTol: 1,
  },
  {
    name: "oklab",
    toAxes: (c) => {
      const { l, a, b } = c.toOklab();
      return [l, a, b];
    },
    fromAxes: ([l, a, b], alpha) => colord({ l, a, b, alpha, ok: true }),
    alphaOf: (c) => c.toOklab().alpha,
    toCss: (c) => c.toOklabString(),
    refForward: refRgbToOklab,
    refBackward: refOklabToRgb,
    polar: false,
    axisTol: 1e-4,
    hueTol: 0,
    minChromaForHue: 0,
    roundtripTol: 0,
  },
  {
    name: "oklch",
    toAxes: (c) => {
      const { l, c: chroma, h } = c.toOklch();
      return [l, chroma, h];
    },
    fromAxes: ([l, c, h], a) => colord({ l, c, h, a, ok: true }),
    alphaOf: (c) => c.toOklch().a,
    toCss: (c) => c.toOklchString(),
    refForward: (r, g, b) => toPolar(refRgbToOklab(r, g, b)),
    refBackward: (oklch) => refOklabToRgb(toRectangular(oklch)),
    polar: true,
    axisTol: 1e-4,
    hueTol: 0.01,
    minChromaForHue: 0.05,
    roundtripTol: 0,
  },
];

const [lab, lch, oklab, oklch] = SPACES;

/**
 * The color-value matrix: sRGB extremes (black, white, primaries), grays,
 * near-boundary bytes (#010203 below the linearization threshold, #fefdfc
 * a hair under white, where the D50 clamp bites) and ordinary colors.
 */
const MATRIX = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#00ffff",
  "#ff00ff",
  "#808080",
  "#c0c0c0",
  "#332211",
  "#d53987",
  "#aabbcc",
  "#c65d06",
  "#123456",
  "#fed830",
  "#010203",
  "#fefdfc",
];

/** Byte-exact and short-decimal alphas, plus the [0, 1] bounds */
const ALPHAS = [0, 0.25, 0.5, 0.75, 1, 1 / 255, 128 / 255];

/** Out-of-sRGB-gamut colors: the library's policy is a per-channel clip */
const OUT_OF_GAMUT: Array<{ css: string; space: Space; axes: Vec3; alpha?: number }> = [
  { css: "lab(50% 150 150)", space: lab, axes: [50, 150, 150] },
  { css: "lab(55% -160 -40 / 0.5)", space: lab, axes: [55, -160, -40], alpha: 0.5 },
  { css: "lch(60% 200 30)", space: lch, axes: [60, 200, 30] },
  { css: "lch(45% 130 290 / 50%)", space: lch, axes: [45, 130, 290], alpha: 0.5 },
  { css: "oklab(0.7 0.3 0.3)", space: oklab, axes: [0.7, 0.3, 0.3] },
  { css: "oklab(0.55 -0.2 -0.35 / 0.5)", space: oklab, axes: [0.55, -0.2, -0.35], alpha: 0.5 },
  { css: "oklch(0.8 0.29 145)", space: oklch, axes: [0.8, 0.29, 145] },
  { css: "oklch(0.65 0.4 300 / 50%)", space: oklch, axes: [0.65, 0.4, 300], alpha: 0.5 },
  // L = 0 with non-zero chroma is "below black", not black: it converts per
  // the spec math and then clips (powerless components only affect interpolation)
  { css: "oklch(0 0.5 120)", space: oklch, axes: [0, 0.5, 120] },
];

interface SpaceReport {
  axisError: number;
  hueError: number | null;
  alphaError: number;
  roundtripError: number;
  gamutClipError: number;
}

const report: Record<string, SpaceReport> = {};
for (const space of SPACES) {
  report[space.name] = { axisError: 0, hueError: null, alphaError: 0, roundtripError: 0, gamutClipError: 0 };
}

describe("CSS Color 4 gamut boundaries", () => {
  it("matches the reference conversions within rounding tolerance", () => {
    for (const space of SPACES) {
      let axisError = 0;
      let hueError = 0;

      for (const hex of MATRIX) {
        const [r, g, b] = hexToRgb(hex);
        const actual = space.toAxes(colord(hex));
        const expected = space.refForward(r, g, b);

        for (const i of space.polar ? [0, 1] : [0, 1, 2]) {
          axisError = Math.max(axisError, Math.abs(actual[i] - expected[i]));
        }

        if (space.polar && expected[1] >= space.minChromaForHue) {
          const diff = Math.abs(actual[2] - expected[2]) % 360;
          hueError = Math.max(hueError, Math.min(diff, 360 - diff));
        }
      }

      report[space.name].axisError = axisError;
      report[space.name].hueError = space.polar ? hueError : null;
      expect(axisError).toBeLessThanOrEqual(space.axisTol);
      if (space.polar) expect(hueError).toBeLessThanOrEqual(space.hueTol);
    }
  });

  it("preserves alpha through every space", () => {
    for (const space of SPACES) {
      let alphaError = 0;

      for (const hex of MATRIX) {
        const [r, g, b] = hexToRgb(hex);

        for (const a of ALPHAS) {
          const converted = colord({ r, g, b, a });
          const alpha = space.alphaOf(converted);
          alphaError = Math.max(alphaError, Math.abs(alpha - a));

          // The 8-bit alpha byte survives a full round trip through the object form
          const restored = space.fromAxes(space.toAxes(converted), alpha);
          expect(Math.round(restored.toRgb().a * 255)).toBe(Math.round(a * 255));
        }
      }

      // `roundAlpha` keeps at most 3 decimals and may collapse to 2 when the short
      // form names the very same 8-bit byte (0x80 ↔ 0.5, the way browsers print it),
      // so the object form can drift by half a byte — but never across a boundary,
      // which the byte-exact round-trip assertion above verifies
      report[space.name].alphaError = alphaError;
      expect(alphaError).toBeLessThanOrEqual(0.5 / 255);
    }
  });

  it("round-trips through the object and CSS string forms", () => {
    for (const space of SPACES) {
      let roundtripError = 0;

      for (const hex of MATRIX) {
        const original = colord(hex).toRgb();

        for (const converted of [
          space.fromAxes(space.toAxes(colord(hex)), 1),
          colord(space.toCss(colord(hex))),
        ]) {
          const rgb = converted.toRgb();
          roundtripError = Math.max(
            roundtripError,
            Math.abs(rgb.r - original.r),
            Math.abs(rgb.g - original.g),
            Math.abs(rgb.b - original.b)
          );
        }
      }

      report[space.name].roundtripError = roundtripError;
      expect(roundtripError).toBeLessThanOrEqual(space.roundtripTol);
    }
  });

  it("clips out-of-gamut colors per channel, the same as the reference", () => {
    for (const { css, space, axes, alpha = 1 } of OUT_OF_GAMUT) {
      const expected = space.refBackward(axes).map(clipByte);
      const actual = colord(css).toRgb();
      const error = Math.max(
        Math.abs(actual.r - expected[0]),
        Math.abs(actual.g - expected[1]),
        Math.abs(actual.b - expected[2])
      );

      report[space.name].gamutClipError = Math.max(report[space.name].gamutClipError, error);
      expect(error).toBeLessThanOrEqual(1);
      expect(actual.a).toBe(alpha);
    }
  });

  it("clamps extreme axis values before converting, identically on every input path", () => {
    // L outside [0, 100] / [0, 1] is clamped at parse time (CSS Color 4), then converted
    expect(colord("lab(0% 0 0)").toHex()).toBe("#000000");
    expect(colord("lab(100% 0 0)").toHex()).toBe("#ffffff");
    expect(colord("lab(150% 0 0)").toHex()).toBe("#ffffff");
    expect(colord("lab(-50% 0 0)").toHex()).toBe("#000000");
    expect(colord("oklab(0 0 0)").toHex()).toBe("#000000");
    expect(colord("oklab(1 0 0)").toHex()).toBe("#ffffff");
    expect(colord("oklab(1.5 0 0)").toHex()).toBe("#ffffff");
    expect(colord("oklab(-0.5 0 0)").toHex()).toBe("#000000");
    // L = 0 is black at zero chroma (non-zero chroma at L = 0 is out of gamut —
    // see the OUT_OF_GAMUT matrix — not an automatic black)
    expect(colord("oklch(0 0 120)").toHex()).toBe("#000000");
    expect(colord("oklch(1 0 0)").toHex()).toBe("#ffffff");

    // The string and object paths agree, and both match clamping first, then converting
    expect(colord("lab(130% -60 60)").toHex()).toBe(colord({ l: 130, a: -60, b: 60 }).toHex());
    expect(colord("lab(130% -60 60)").toHex()).toBe(colord("lab(100% -60 60)").toHex());
    expect(colord("oklch(1.2 0.1 30)").toHex()).toBe(
      colord({ l: 1.2, c: 0.1, h: 30, ok: true }).toHex()
    );
    expect(colord("oklch(1.2 0.1 30)").toHex()).toBe(colord("oklch(1 0.1 30)").toHex());
  });

  it("clamps alpha at parse time in every CSS Color 4 model", () => {
    // The string and object paths clamp alpha identically — the LCH object path
    // used to leave alpha unclamped until the downstream RGB clip caught it
    expect(colord("lab(50% 0 0 / 2)").toRgb().a).toBe(1);
    expect(colord("lab(50% 0 0 / -1)").toRgb().a).toBe(0);
    expect(colord("lch(50% 20 30 / 2)").toRgb().a).toBe(1);
    expect(colord("lch(50% 20 30 / -1)").toRgb().a).toBe(0);
    expect(colord({ l: 50, c: 20, h: 30, a: 2 }).toRgb().a).toBe(1);
    expect(colord({ l: 50, c: 20, h: 30, a: -1 }).toRgb().a).toBe(0);
    expect(colord("oklab(0.5 0 0 / 150%)").toRgb().a).toBe(1);
    expect(colord("oklch(0.5 0.1 30 / -10%)").toRgb().a).toBe(0);
    expect(colord({ l: 0.5, c: 0.1, h: 30, a: 2, ok: true }).toRgb().a).toBe(1);
  });

  it("treats achromatic colors as hue-independent", () => {
    expect(colord("lch(50% 0 123)").toHex()).toBe(colord("lch(50% 0 0)").toHex());
    expect(colord("oklch(0.5 0 250)").toHex()).toBe(colord("oklch(0.5 0 0)").toHex());
    // Negative chroma is clamped to 0, so the hue stops mattering
    expect(colord({ l: 50, c: -30, h: 40 }).toHex()).toBe(colord({ l: 50, c: 0, h: 40 }).toHex());
    expect(colord({ l: 0.5, c: -0.1, h: 40, ok: true }).toHex()).toBe(
      colord({ l: 0.5, c: 0, h: 40, ok: true }).toHex()
    );
  });

  afterAll(() => {
    // Human-readable summary of the metrics asserted above:
    // per-space numerical error vs the reference, alpha preservation,
    // round-trip and out-of-gamut clip deviations (in 8-bit bytes)
    console.table(report);
  });
});
