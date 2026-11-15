# Asset attributions

The interface polish follows [Unslop](https://github.com/heydamir/unslop) by [Damir Sokolovsky (@heydamir)](https://x.com/heydamir), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its guidance was adapted to IGNIS's existing graphite and ember palette, typography, habitat previews, and research interface.

Vendored files load from this site. The app does not request them from a third-party CDN at runtime. NASA insignia, the worm, and flags are not used as endorsements. The Gateway scene stays a conceptual composite even where an official module model is the mesh.

Retrieved 2026-11-12.

| File | Source | Licence | Use |
|---|---|---|---|
| `public/textures/mars/rocky_trail_02_*.webp` | [Poly Haven — Rocky Trail 02](https://polyhaven.com/a/rocky_trail_02) by Amal Kumar. 2K JPG set, albedo mixed 45% toward `#6F5A4A`, re-encoded to WebP. | CC0 1.0 | Mars ground color, normal, roughness, and AO. |
| `public/models/namaqualand-rocks.glb` and `public/textures/mars/namaqualand_*.webp` | [Poly Haven — Namaqualand Rocks 01](https://polyhaven.com/a/namaqualand_rocks_01) by Greg Zaal and Jenelle van Heerden. Albedo mixed 40% toward `#6F5A4A`. | CC0 1.0 | Two High-tier Mars boulders, 1.8–2.2 m, buried 18%. Maps are rebound beside the mesh. |
| MARSHA shell | Procedural reconstruction of AI SpaceFactory’s MARSHA, grand-prize winner of NASA’s 2019 3D-Printed Habitat Challenge. Published full-scale reading: 13.72 m tall, radii 3.18 / 3.66 / 1.92 m, print period 0.152 m. Design lead Jeffrey Montes, David Malott, and Christopher James Botham. There is no reusable official mesh. | Inspired-by, conceptual. Not an official AI SpaceFactory or NASA asset. | Mars habitat form only. |
| `public/models/curiosity.glb` and `curiosity-25k.glb` | [NASA Curiosity static](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24584_Curiosity_static.glb), NASA VTAD / JPL-Caltech. Draco + WebP, scale 0.735 (longest axis 2.9 m). The 25k file is a decimated Medium-tier copy. | U.S. government work, public domain | Mars foreground rover on High and Medium. Low skips it. |
| `public/models/gateway-core.glb` | [NASA Gateway Core](https://github.com/nasa/NASA-3D-Resources/blob/master/3D%20Models/Gateway/Gateway%20Core.glb). Graphics Alberto G. Bertolin and Bradley W. Reynolds, Graphics and Animation LAB JSC. Draco + WebP at 1024 px. Metres, not scaled by 0.001. | U.S. government work, public domain | Desktop Gateway mesh. Mobile keeps the procedural T-stack. |
| `public/textures/space/low_lunar_orbit_4k.jpg` and `low_lunar_orbit_2k.jpg` | [Low Lunar Orbit.jpg](https://github.com/nasa/NASA-3D-Resources/blob/master/3D%20Models/Gateway/Low%20Lunar%20Orbit.jpg), same Gateway credit. 8192×4096 source, downsampled. | U.S. government work, public domain | Desktop Gateway background and PMREM. Stars and a second Moon disc are not drawn on top of it. |
| `public/textures/moon/apollo11_nac_dtm_2048.png` and `_1024.png` | LROC NAC DTM `NAC_DTM_APOLLO11`, 2 m/pixel, NASA / GSFC / ASU. Source GeoTIFF `https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/APOLLO11/NAC_DTM_APOLLO11.TIF`. A 2048×2048 window around the Apollo 11 site (about 0.67°N, 23.47°E), saved as 16-bit PNG. 0 = −80 m and 65535 = +80 m relative to the pad. Mobile is the same window at 1024 (4 m/pixel). | U.S. government work, public domain | Moon terrain height only. Not a habitat module. The raw 113 MB GeoTIFF is not in the repo. |
| `public/textures/moon/apollo11_nac_albedo_2048.webp` and `_1024.webp` | Matching orthorectified NAC `NAC_DTM_APOLLO11_M150361817_2M` (M150361817), same window. | U.S. government work, public domain | Moon ground colour. NAC is panchromatic. |
| `public/textures/moon/apollo11_nac_ao_*.webp` | Derived from the DTM crop (slope and low spots). | Derived from the public-domain DTM | Ground `aoMap` on every tier. |
| `public/models/foster_esa_mound.glb` | SDF / marching-cubes reconstruction from the published Foster+Partners / ESA 2013 lunar habitation study (Xavier De Kestelier / Specialist Modelling Group, Enrico Dini / D-Shape, Cesaretti et al.). v3 mesh, 33,676 triangles: 1.5 m wall held at the mouth, rounded torus lip, front plane-cut. | Inspired-by, conceptual. Not an official ESA or Foster+Partners mesh. | Moon printed-regolith shell. Used as supplied. |
| `public/models/Apollo_Lunar_Module_30k.glb` | NASA Apollo Lunar Module, credit NASA / Michael D. Carbajal. [NASA 3D Resources](https://science.nasa.gov/3d-resources/apollo-lunar-module/). Decimated to 27,517 triangles, scaled to the real 7.04 m height. The historical flag on the descent stage is part of the official mesh. | U.S. government work, public domain. Not an endorsement. | Moon scale prop, left mid-ground. No astronaut or rover. |
| `public/textures/moon/moon_01_*.webp` | [Poly Haven — Moon 01](https://polyhaven.com/a/moon_01) by Greg Zaal, Rico Cilliers, Jenelle van Heerden, and Dario Barresi. 2K JPGs. Albedo desaturated and mixed toward `#6E6A62`. | CC0 1.0 | Moon ground and mound colour, normal, roughness, and AO. |
| `public/models/moon-rocks.glb` | [Poly Haven Moon Rocks 01–04](https://polyhaven.com/a/moon_rock_01) by Greg Zaal, Rico Cilliers, Jenelle van Heerden, and Dario Barresi. 1K glTF, WebP + Draco. | CC0 1.0 | Four grey lunar boulders, scaled to about 0.85–1.85 m and buried about 18%. Not the Mars Namaqualand set. |
| `public/textures/moon/blue_marble_1k.jpg` | Blue Marble Next Generation, NASA Earth Observatory / NASA Goddard / Reto Stöckli. Wikimedia public-domain mirror of the 3600×1800 plate, downsampled to 1024×512. | U.S. government work, public domain | 2° Earth disc in the lunar sky only. Not used on Gateway. |
| `public/textures/cc0/moon_lab_1k.hdr` | [Poly Haven — Moon Lab](https://polyhaven.com/a/moon_lab) by Greg Zaal. | CC0 1.0 | Moon reflections only, intensity 0.05. Not the Mars sky and not the Gateway plate. |
| `public/textures/cc0/ground048_*.webp` | [ambientCG Ground048](https://ambientcg.com/view?id=Ground048). | CC0 1.0 | Retained from the previous pass. The Mars ground now uses Rocky Trail 02, including its AO. |
| `public/draco/` | Draco decoder from `three` `examples/jsm/libs/draco/gltf`. | Apache-2.0 (three.js) | Local decoder. Models do not load a decoder from a CDN. |

## Not shipped this pass

- **KTX2 / Basis.** Textures are WebP (models) or JPEG (the orbit plate). `EXT_texture_webp` loads in the browsers this app targets, and the Gateway Core file is 3.78 MB rather than the raw 66 MB. A KTX2 transcode was not produced.
- **Rock Ground 02, Aerial Ground Rock, Rock Boulder Dry.** Not vendored. The Mars ground is Rocky Trail only; rock faces use the Namaqualand atlas.
- **Perseverance, Ingenuity, ISS (B).** Optional, not vendored.
- **CGI Moon Kit ldem, Deep Star Maps, and the Low Lunar Orbit plate on the Moon.** Not used for the lunar surface. Gateway keeps its own Low Lunar Orbit plate.
- **HiRISE, Perseverance, and KTX2.** Not in this pass.
- **HiRISE Jezero DTM.** The 1.8 GB GeoTIFF was not downloaded. Terrain height stays the procedural dune / crater warp under Rocky Trail.
- **Moon Lab 2k.** The 1k HDR remains the reflection map.
