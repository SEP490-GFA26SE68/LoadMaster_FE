/*
 * Hệ hiện chữ một lần của trang giới thiệu. `RevealProvider` bọc nội dung `LandingPage`; mọi thứ khác chỉ chuyển động bên trong nó (ngoài
 * nó — `/bang-gia`, jsdom, giảm chuyển động — vẽ đúng phần tử như không có hệ này). Một IntersectionObserver, CSS keyframes ở `reveal.css`
 * (riêng Lumo nói ở `lumo-says.css`).
 *
 * Chữ chuyển động ("chảy chữ"): `RevealWords` (từng từ nhô lên / sóng mực qua đoạn văn), `FlowHeading` (từng grapheme nhô lên theo sóng),
 * `LineRise` (từng dòng nhô lên từ mặt nạ), `TextRibbon` (hàng cụm chữ trôi ngang theo cuộn). Chuyển động theo cuộn khi trình duyệt thiếu
 * view timeline: `useScrollProgress` (`--scroll-p`).
 */
export { FlowHeading } from './FlowHeading'
export { LineRise } from './LineRise'
export { LumoSays, lumoSizesAttr, type LumoSizes } from './LumoSays'
export { Odometer } from './Odometer'
export { Reveal, type RevealKind, type RevealTag } from './Reveal'
export { RevealProvider, useRevealMotion, useRevealRef } from './RevealProvider'
export { RevealWords } from './RevealWords'
export { coverProgress, supportsViewTimeline, useScrollProgress } from './scroll-link'
export { graphemes, sentences, typeStep, words } from './split-text'
export { TextRibbon } from './TextRibbon'
