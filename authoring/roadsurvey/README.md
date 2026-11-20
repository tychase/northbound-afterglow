# US 1 road-art reference

`naip2023-reference.jpg` is a bounded export of the USDA National Agriculture Imagery Program 2023 Florida imagery, served by USFS GTAC / DOI GeoPlatform. [Federal dataset and public-domain label](https://catalog.data.gov/dataset/national-agriculture-imagery-program-naip-imagery) · [image service metadata](https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2023_CONUS/ImageServer/info/iteminfo?f=pjson).

[Reproduce the source export](https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2023_CONUS/ImageServer/exportImage?bbox=519490%2C3158390%2C520180%2C3160090&bboxSR=32617&imageSR=32617&size=1380%2C3400&format=jpg&bandIds=0%2C1%2C2&f=image). Reference SHA-256: `b3cf923b6c17bf3a6df41d00e85a31469669af709251ca4afda9b4f97c68dc44`.

The image informs the divided highway, turn pockets, cross-street approaches, shore distances and building massing. It is not a runtime texture or a street-level survey. `review.py` uses Pillow, NumPy and the game's route module to align the reference with distance along US 1. Exact facades, signal hardware, heights, park access and individual stripes are illustrative. See [the route source notes](../../notes/maps/README.md) for separate carriageway, park and centerline provenance.
