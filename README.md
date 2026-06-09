# Projeksiyon Mapper

Tarayıcı tabanlı, açık kaynak projeksiyon mapping (eşleme) editörü. Resolume / MadMapper benzeri arayüz, sıfır kurulum, %100 istemci tarafı.

WebGL2 + React + TypeScript ile yazıldı. Three.js yok — saf düşük seviye WebGL ile maksimum performans.

## Özellikler

### Bükme (Warp) Modları
- **Quad Warp** — 4 köşe perspektif düzeltme. Gerçek 3×3 homografi matrisi (Gauss eliminasyonu ile çözülür), vertex shader'a `mat3` uniform olarak geçer.
- **Mesh Warp** — Eğri yüzeyler için 3×3'ten 20×20'ye ayarlanabilir ızgara. Her vertex sürüklenebilir, üçgen bazlı bükme, canlı wireframe önizleme.

### Medya Kaynakları
- Video dosyaları (mp4, webm) — donanım hızlandırmalı, `readyState >= 2` kontrolüyle texture yükleme
- Görseller (jpg, png, gif)
- Canlı kamera (`getUserMedia`)
- Ekran paylaşımı (`getDisplayMedia`)
- GLSL fragment shader'lar — canlı düzenleyici, presetler (plazma, gürültü, gradyan, ses-tepkili)

### Katman Sistemi
- Sınırsız katman
- Blend modları: normal, multiply, screen, add (native `blendFuncSeparate`)
- Opaklık, görünürlük, kilit kontrolleri
- Sürükle-bırak sıralama
- Opsiyonel maske

### Sahne ve Timeline
- Çoklu sahne yönetimi
- Sahne başına süre tanımlama
- Otomatik geçiş (play / pause / stop)
- Sahne arası hızlı geçiş

### Projeksiyon Çıkışı
- Ayrı pencere açma (`#/output` rotası)
- `BroadcastChannel` ile editör → çıkış senkronizasyonu
- Tam ekran API desteği
- Çoklu monitör / projektör kurulumu için uygun

### Proje Kaydet/Yükle
- JSON formatında proje export/import
- Medya meta verisi kayıt edilir, dosyalar yeniden yüklenir

## Kurulum

```bash
git clone https://github.com/KULLANICI_ADI/projeksiyon-mapper.git
cd projeksiyon-mapper
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` açılır.

## Build

```bash
npm run build
```

`dist/` klasörüne statik dosyalar üretilir. Herhangi bir statik host'a (GitHub Pages, Netlify, Vercel, S3, Nginx) deploy edilebilir.

## Kullanım

1. **Katman ekle** — Sol panelden `+` ile video/görsel/kamera/ekran/shader katmanı ekle.
2. **Bükme modu seç** — Sağ panelden Quad veya Mesh seç.
3. **Köşeleri sürükle** — Tuval üzerindeki cyan handle'ları sürükleyerek bük.
4. **Sahne oluştur** — Alt panelden farklı sahneler oluştur, geçiş süresi ayarla.
5. **Projeksiyon moduna geç** — Üst toolbar'daki butonla ayrı pencere aç, projektöre taşı.

## Teknik Detaylar

### Mimari
```
client/src/
├── App.tsx                      # Router (Editor + Output)
├── main.tsx                     # Dark mode zorlanır
├── index.css                    # Tema tokenları (koyu + electric cyan)
├── lib/
│   ├── store.ts                 # Zustand: project, scenes, layers, selection
│   ├── webgl/
│   │   ├── renderer.ts          # Tek rAF döngüsü, cache'li shader programları
│   │   ├── shaders.ts           # Vertex/fragment shader kaynakları
│   │   ├── homography.ts        # 4-nokta homografi çözücü
│   │   ├── mesh.ts              # NxM ızgara üretimi + üçgenleme
│   │   └── blend-modes.ts       # Blend modu → GL config
│   ├── media/                   # video/camera/screen/shader kaynakları
│   ├── project-io.ts            # JSON export/import
│   └── broadcast.ts             # BroadcastChannel senkron
├── components/
│   ├── Toolbar.tsx
│   ├── LeftSidebar.tsx          # Katmanlar + Sahneler sekmeleri
│   ├── RightSidebar.tsx         # Seçili katmanın özellikleri
│   ├── CanvasView.tsx           # WebGL canvas + warp handle overlay
│   ├── WarpHandles.tsx
│   ├── Timeline.tsx
│   └── Logo.tsx
└── pages/
    ├── Editor.tsx
    ├── Output.tsx               # Sadece composite çıktı, UI yok
    └── not-found.tsx
```

### Performans Notları
- Tek `requestAnimationFrame` döngüsü
- Cache'li shader programları (sadece kaynak değişince yeniden derlenir)
- Video texture upload sadece frame değişince yapılır
- WebGL2 ile MRT, instancing gibi gelişmiş özellikler kullanılabilir

## Yol Haritası

- [ ] Per-layer keyframe animasyonu
- [ ] OSC / MIDI girdi desteği
- [ ] Ses analizi → reaktif shader uniformları
- [ ] IndexedDB ile otomatik proje kaydı
- [ ] Spout / Syphon-vari çıkış (NDI alternatifi)
- [ ] Çoklu-projektör edge blending

## Tarayıcı Desteği

- Chrome / Edge 90+ (WebGL2 + getDisplayMedia)
- Firefox 90+
- Safari 15+ (sınırlı `getDisplayMedia`)

## Lisans

MIT
