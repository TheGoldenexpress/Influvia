# Portrait artwork

The hero's social marks, camera, shop, growth chart, megaphone and connection paths are original inline SVG/CSS artwork in `components/hero-motion.tsx`, animated locally with GSAP. No external video, tracking embeds, or user-supplied screen recording is included in the published background. The 20261022-1926 reference recording was reviewed locally to identify where the existing hero and scrolling needed more detail.

## Current design: 100 full-colour sample portraits

`public/sample-influencers-color.png` is the current 10 × 10 atlas of 100 fictional adult creator portraits. Black, white and grey are used for the interface; photographs retain natural colour. This colour edit was generated with the built-in image generation tool from the initial atlas below. The website crops the atlas with SVG and Three.js. Original output: `C:/Users/SEO/.codex/generated_images/01a163f1-6c16-7ee1-98e4-27fa660fe120/exec-5dd9aded-7b07-4536-ba6f-dab1524460d0.png`.

Final colour-edit prompt:

> EDIT TARGET: the provided exact 10-column by 10-row grid of 100 fictional Indian adult portrait photographs. Keep exactly the same 100 people, identity, facial features, hairstyle, pose, cropping, cell positions, grid boundaries and image dimensions. Convert the entire image into crisp contemporary FULL COLOUR digital portrait photography. Natural warm brown skin tones, realistic black and dark brown hair, contemporary wardrobe with tasteful varied colours: cream, black, indigo denim, muted coral, forest green, burgundy, charcoal. Soft coloured neutral backgrounds in warm ivory, pale stone, grey, light muted blue. Natural true colour, clean high-resolution camera quality, sharp eyes and hair detail. Modern creator portrait photography from 2026. No grayscale, no vintage film, no grain, no sepia, no faded retro tones, no haze, no blur, no TV effects. Preserve the precise 10x10 geometry, no gutters, no borders, no text or graphics. Each of the 100 subjects stays within its own cell. No new people, no removed people, no overlapping cells.

## Initial portrait atlas

`public/sample-influencers.png` is an original generated 10 × 10 portrait atlas containing 100 fictional Indian adult portraits. The interface uses 100 separate SVG crops and matching Three.js texture crops. All sample profiles are labelled; these people are not real directory members or endorsements. Real uploaded photo URLs take precedence. Live records without photos use labelled placeholders.

Generated with the built-in image generation tool. Original output: `C:/Users/SEO/.codex/generated_images/01a163f1-6c16-7ee1-98e4-27fa660fe120/exec-a4ddf3d1-644e-4c4a-b30e-9d92f5030026.png`.

Final generation prompt:

> Create a photographic asset contact sheet with EXACTLY 100 distinct fictional Indian adult creator headshots, arranged in a precise 10-column by 10-row grid, with no gutters, no gaps, no frames, no text, no lettering, no numbers, no watermarks, no interface. Output portrait-oriented 2048x2560 pixels if possible. Each of the 100 rectangular cells must contain one different person centered inside that cell, head and shoulders, fully visible head with space above the hair, eyes near the upper third, looking naturally toward camera. Each cell is a separate portrait photo. Include a broad variety of Indian adult men and women ages 22 to 45, varied hairstyles, beards, clean-shaven faces, glasses, contemporary and traditional clothing, some women wearing hijab, creators in food, fashion, property, and lifestyle. All 100 subjects must be different fictional people; never repeat a face. Sophisticated black-and-white editorial photography, authentic natural facial features and skin texture, soft directional studio light, varied neutral grey backgrounds. Pure grayscale throughout. All faces wholly inside their own grid cell, no overlapping between cells. This atlas will supply 100 sample influencer profile photographs for a monochrome directory website.

The monochrome IV monogram in `components/shared.tsx`, `public/logo.svg`, and `public/favicon.svg` is original vector artwork created for this website.

## Reference-led redesign

`public/creator-editorial-v3.png` was generated with the built-in image generation tool. The image is used as a three-panel atlas for the rounded portrait tiles, the interactive React Three Fiber gallery, and sample directory cards. These are fictional illustrative people.

Original output: `C:/Users/SEO/.codex/generated_images/01a163f1-6c16-7ee1-98e4-27fa660fe120/exec-6e307515-98c0-44e1-8e44-cb65b8e36883.png`.

Final prompt:

> Create one photorealistic editorial contact sheet for INFLUVIA, an Indian local creator discovery website. EXACT layout: three equally wide vertical photographic panels side by side, no gaps or borders, 1536x1024 landscape. Each panel contains a different fictional Indian content creator with their face centered horizontally and fully visible within the upper half, framed waist-up. LEFT: lively young Indian woman food storyteller in a deep orange kurta holding a small camera at a sunlit Hyderabad cafe, warm cinematic ochre light, natural beautiful smile. CENTER: stylish young Indian man with short dark hair and beard in an ivory textured overshirt at a terracotta architectural courtyard, composed candid expression, sage greenery. RIGHT: elegant young Indian woman in a black outfit and subtle jewelry making a clothing video at a contemporary warm ivory studio, expressive friendly face. Sophisticated magazine photography, authentic Indian features, rich realistic skin texture, restrained warm colors, cinematic natural light, shallow depth of field. Keep each person entirely in their own third. No text, logos, symbols, watermarks, no UI, no collage overlap. All people are fictional illustrative profiles.

The two user-provided video recordings were inspected locally for visual layout and movement. They are not distributed with the application. The implementation uses original interface code and generated portrait artwork.

## Earlier portrait asset

`public/creator-portraits.png` was generated with the built-in image generation tool and copied into the project. Original output: `C:/Users/SEO/.codex/generated_images/01a163f1-6c16-7ee1-98e4-27fa660fe120/exec-1ab01cb2-cb52-4d2e-8723-4df5779b5bda.png`.

The people are fictional sample subjects, not actual directory members or endorsements. The three panels are used as CSS image crops and Three.js card textures.

Generation prompt:

> Create a premium editorial photographic contact sheet for an Indian creator discovery website called INFLUVIA. Output one landscape image with precisely THREE equal vertical portrait panels side by side, without gaps or borders. Each panel is a completely separate sophisticated waist-up editorial portrait, head centered at the same height, eyes looking at camera, heads completely inside panel, natural real skin texture, tasteful daylight photography, high quality 50mm portrait photography. Left third: smiling young adult Indian woman with long dark hair, olive green linen shirt, warm apricot studio background, food and lifestyle creator. Middle third: stylish young adult Indian man with short dark textured hair, small neat beard, black t-shirt and terracotta overshirt, pale sage background, travel and real estate creator. Right third: young adult Indian Muslim woman with elegant deep burgundy headscarf and cream contemporary clothing, subtle smile, pale warm cream studio background, fashion creator. Human, warm, confident, not glamour retouched. Premium magazine editorial art direction, clean cohesive warm color grading. These are fictional illustrative people, no known public figures. No writing, no numbers, no logos, no overlays, no graphic cards, no interface elements. Each portrait fills its entire third. Approximate aspect ratio 3:2. Save output as an image asset suitable for use as a three-panel portrait texture.
