# PDF fonts

These unmodified static fonts are embedded into exported PDFs to preserve Bengali and Latin text:

- [Noto Sans Bengali Regular/Bold](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSansBengali)
- [Noto Sans Regular/Bold](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans)

The bundled `OFL.txt` contains the Noto copyright notice and SIL Open Font License 1.1. Preserve it when redistributing the fonts. Bengali runs use Noto Sans Bengali; Latin runs use Noto Sans because the Bengali fonts do not provide complete Latin coverage. `npm run verify:pdf --workspace frontend` checks both scripts, multipage exports and layout bounds.
