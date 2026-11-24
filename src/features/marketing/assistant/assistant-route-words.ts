import type { TopicId } from './assistant-kb'

/**
 * Từ vựng của bộ định tuyến (`assistant-route.ts`, dữ liệu phẳng): chữ đã chuẩn hoá (`chatText`, ASCII không dấu, vi + en).
 *
 * - `STOP_WORDS`: chữ chức năng — hỏi, xưng hô, nối câu — không mang chi tiết nào.
 * - `TOPIC_VOCAB`: chữ mà câu soạn sẵn của chủ đề **đã nói tới** (câu trả lời ở nhánh `assistant` vi / en và phần dựng từ dữ liệu). Một
 *   câu chỉ được trả sẵn khi mọi chữ của nó là chữ chức năng hoặc nằm trong từ vựng của chủ đề khớp được. Cố ý **không** có chữ mà câu
 *   soạn sẵn không trả lời dù là từ khoá của chủ đề: "nạp", "hết" (credit), "demo" (dùng thử), "app" (thiết bị — câu trả lời nói trình
 *   duyệt, không nói ứng dụng cài), "trọng tâm" (tải trục), "barcode" (đối chiếu).
 */
const words = (text: string): ReadonlySet<string> => new Set(text.split(/\s+/).filter((word) => word !== ''))

export const STOP_WORDS = words(`
  co khong la gi nao the nhu bao nhieu cho toi minh em anh chi ban oi a ah vay voi cua cac nhung mot duoc khi thi de sao lam nay va o
  tren trong ve can muon hoi xin giup nhe nha ha di roi chua phai biet ra dau ai admin lumo loadmaster he thong phan mem ung su cung
  them nua hay luon moi tung deu se dang vui please it cai ma vao bang tu kieu loai ben thoi chu nhi ne hen vang
  da duoc hoac hien chao 1
  the a an is are am do does did can could would will i you your my me we us our it its of to for on in at by with how what which who
  any there be have has get please much many this that these those s t so just about from need want like one way tell know out
  does it there any m ll ve re d hi hello
`)

export const TOPIC_VOCAB: Readonly<Record<TopicId, ReadonlySet<string>>> = {
  plans: words(`
    gia bang goi cuoc tien chi phi thang basic pro ultimate dong vnd credit credits gioi han kem ban
    price prices pricing cost costs plan plans subscription month monthly per fee fees limit unlimited
  `),
  credit: words(`
    credit credits tin chi lan chay toi uu ton mat cong don du sang ky thang sau tuyen diem giao thu xep hang 3d
    per run runs optimization optimizations optimize use uses cost costs carry over left leftover next period route routes stop stops
    order loading load
  `),
  advisor: words(`
    goi nao hop phu chon nen tu van cong ty
    plan plans which fits fit right best recommend suggest company choose pick should for
  `),
  start: words(`
    dung thu trai nghiem dang ky bat dau mo tao tai khoan
    trial try free sign signup up register started start create account
  `),
  howItWorks: words(`
    hoat dong cach quy trinh buoc cac lam viec dung
    work works working workflow process steps step use
  `),
  roles: words(`
    vai tro cong ty nguoi dung dieu phoi nhan vien kho tai xe quan ly
    roles role company dispatcher dispatchers driver drivers warehouse staff users user manager managers uses use
  `),
  devices: words(`
    dien thoai may tinh bang di dong trinh duyet thiet bi dung tai xe nhan vien kho
    mobile phone phones tablet tablets browser device devices work works driver drivers warehouse staff computer desktop use
  `),
  packages: words(`
    nhap kien hang excel file tu them tung mau nhan qr in ma
    packages package parcel parcels enter import label labels upload template add print
  `),
  verify: words(`
    quet qr ma doi chieu dung kien nham xep giao hang nhan tranh sai
    scan scanning right wrong verify check package packages loaded delivered load deliver sure make label
  `),
  loading3d: words(`
    3d xep hang phuong an thung xe toi uu chat xem xoay chinh tay duyet gom mau
    load loading plan plans packing cargo layout stacking show view rotate adjust edit box color
  `),
  axle: words(`
    tai truc xe qua can bang kiem canh bao vuot gioi han
    axle axles load loads overload overloaded check warn warning limit limits
  `),
  routes: words(`
    tuyen duong toi uu lo trinh diem giao gio den tre han giam sat ban do vi tri xe canh bao sap xep thu xem
    route routes routing optimize optimise delivery stops stop tracking track late deadline deadlines map truck location arrival
  `),
  tenancy: words(`
    du lieu bao mat tach rieng tu phan quyen cong ty khac xem thay doi an toan
    data privacy security separate permissions isolated kept company companies other see team safe
  `),
  support: words(`
    ho tro yeu cau dung
    support help using once ticket
  `),
  human: words(`
    nhan vien nguoi that tu van lien he noi chuyen gap
    human person real agent contact sales talk speak ask someone team
  `),
  about: words(`
    tro ly
    assistant
  `),
}
