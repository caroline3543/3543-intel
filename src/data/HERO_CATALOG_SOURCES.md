# Hero catalogue sources

Names, portraits, troop classes, generation and widget names: whiteout-survival-data 0.7.1 by Christopher Pezza (MIT), https://github.com/chiefpansancolt/whiteout-survival-data . Images use the corresponding GitHub asset paths pinned to source commit b686c68ba1cc955ee75cf2725a4cd0210ec7cd1e.

Numeric hero IDs were matched against the public game portraits at https://wosoracle.com/assets/wos/heroes/{id}.png and visually checked against the named catalogue. The map covers 50000–50064; later unmatched IDs are intentionally left unknown. No Kingshot ID table is used.

Raw hero equipment EID format, slot order, enhancement/mastery fields and six-step star progression were checked against the provider display implementation: https://whiteoutstats.com/static/app.js?v=20261020kvkcol . Raw slv >100 represents ascended enhancement; display subtracts 100 and marks it red. Chief gear tier boundaries use that provider's lordGearTier implementation. Unknown IDs remain visible in source details and are never guessed into a named hero.

## Dataset licence

MIT License

Copyright (c) 2026 Christopher Pezza

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
