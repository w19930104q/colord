---
"colord": patch
---

Refactor: model the sRGB gamut policy independently of the CSS Color 4 conversion math — `xyzaToRgba` is now a pure conversion and `clampRgba` is applied explicitly at each color space boundary; `clampLcha` clamps alpha at parse time like the other CSS Color 4 models. No observable behavior change ❤️ [@w19930104q](https://github.com/w19930104q)
