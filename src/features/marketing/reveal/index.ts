/*
 * Hệ hiện chữ một lần của trang giới thiệu. `RevealProvider` bọc nội dung `LandingPage`; mọi thứ khác chỉ chuyển động bên trong nó (ngoài
 * nó — `/bang-gia`, jsdom, giảm chuyển động — vẽ đúng phần tử như không có hệ này). Một IntersectionObserver, CSS keyframes ở `reveal.css`
 * (riêng Lumo nói ở `lumo-says.css`).
 */
export { LumoSays, type LumoSizes } from './LumoSays'
export { Odometer } from './Odometer'
export { Reveal, type RevealKind, type RevealTag } from './Reveal'
export { RevealProvider, useRevealMotion, useRevealRef } from './RevealProvider'
export { RevealWords } from './RevealWords'
export { graphemes, typeStep, words } from './split-text'
