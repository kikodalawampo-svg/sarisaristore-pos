/* ============================================================
   KXS SARI-SARI STORE POS — license.js
   License activation & validation.

   SECURITY NOTE (read this before assuming it's unbreakable):
   This is a fully offline app with no license server, so any
   client-side check can eventually be inspected or patched by
   someone determined enough (e.g. via browser devtools). What
   this module DOES give you is reasonable protection against
   CASUAL copying:
     - The 100 valid keys are never stored in plain text in the
       source or shown anywhere in the interface — only salted
       SHA-256 hashes are kept here, so reading this file does
       not hand someone a usable key.
     - Activation is saved to THIS device's local database. A
       copy of the app on another device/browser starts
       unactivated and needs its own key.
   That's it — a deterrent, not a guarantee. Don't claim more.
   ============================================================ */

const LICENSE_FORMAT_RE = /^KXS-MRP-(\d{3})-([A-Z0-9]{4})$/;
const _LICENSE_SALT = "kxs-sarisari-v1-salt";

// Salted SHA-256 hashes of the 100 valid KXS-MRP-###-XXXX keys.
const _LICENSE_HASHES = new Set([
  "d8e471250f2a1c29940681fce30853dd10028f7ece414e0fa6598a37d6a29a36",
  "4ac2edfdbeb8d8c0368b2ef26bb5dee77ef75600f793ab60efbab804281890a5",
  "1ed8587ae3dab94e74d318c9981f1045b6f92cafb65da60a58ac02b53cad8577",
  "f60bf77bee9a23db2799c487b4e243d3c167fce94e309723713d409f85ee769c",
  "7e3b36fe8d81819e6730c8869f96fa384df6a204d16f051ae81e52d538b51151",
  "5647955d515cf8c49f7730ff3ca3c1303e7bf65659207d8f4ef4533460b4944c",
  "f3dcfeafa91a26c0178a265d16ede1533f0a986b12d9fd1089ff8180c35d3b92",
  "a7ef66d9c7618ac91a9dd2c6c844dccddb7b9df12f4605e94ab7bda497a6f446",
  "89dbe02cfb505eb2dd0f988a9553e5a2a7104e8793555650099b5c17e9b3a465",
  "17df09ce24ff5ead4f49828029377098c09343296b244c3a24ae1904a3be5ac3",
  "b8fd9553e9cf9a66053048bf5e75ffbac78116784308de8cfd961fafdf24cba1",
  "c1fb398b73debb2be0888168b96ba5df8f4cb83549056010e61038dd8a606985",
  "26a3d89f53f803bf77f5c35d3db6b0b67992dcc93970c98abca7db715f0a7ba2",
  "bbbc634eeeaf183e90d0e7ab324e24d78decf7746225932116a5aaf6255605da",
  "2d726bdbd80da48a696a0f754aabb7262b28b7bbad7aaac99502d1975104ba60",
  "723943c14bcc90987bebe76733ff613c8669d49cd9cb7da37573f66fca1ad337",
  "1eba3889acd66e4b47b83081fe1d34cc3736329fa1a07a1ec8e1401652cda5e9",
  "1722fdd71886b83f10b7eb0078678136eee2eef125f5904c55f652e7a7b6b84e",
  "5e2bf32ea5ea0b53eed2b4005604f5e7b8021ba70654aeb8c5252bccb24895cc",
  "0c71c4dd6716ee777c3d113743d3a7096b2083b4b79856675e0880acb2ae7e28",
  "b55176ff156ba0ae25fde07d422eb83d21245a99583031b9b69a1636bb45fca1",
  "c2c6cec313bb4733f38959f69a33480b83f3c3268ebbfbaf8ff9e508665df35c",
  "b70640035cb2d32c2489d41dcb1c0263ad4f091fe2bc3a264cfb574408fe3c73",
  "f183aa79eeea2bbd628fc51a0de88b4ecf75b2cc1c3946b0fd717c389da1f9cb",
  "16d4173464d30decd568b8239934f68c20bb23e0b36468b9e716e4c3dbb4cac0",
  "a7491bfd494b3708368b568b34b34ec21f6cea8f067d76bfe758c31fb50fa638",
  "c52445722e011a974403f2a10446dbf3680a9132e1166b5288c3a4fdfbf02c3f",
  "3f4710689b7bd19eb6144606daa5b15518695040a4b854d1440d92f0dd4fa059",
  "a8e60e3425de3504a947d64b652cd6fecdccde99c1bb7b801a75687676117ffb",
  "7783ba9b6ddd5de256bb4e5f41b080d88a7f62d53a4ae4923e89a55046baee99",
  "a99e5c5142a341e8bc227c4daab89426bb5d43688e408559442aa6b00c4c7462",
  "4e12a01063adfa731e3f39094187cbdfa708ab464aa7ef7cc39c372f3ddddc8a",
  "5aefb78b76ab3835157c7c907e7d05f98c11843e4b69fde3a55c489b9a10ab3c",
  "5105a80016bedfb71791dd8742d44b26fcf172c274226b2427584faaccdaaf46",
  "b37e160fb5112ff56233e9f5f0e27b8ac36520b513bb82841cbfda1383d87658",
  "a8ddf8dd5f71989c44734514efef17cdb2571fa48603a279477a70044db0bffa",
  "93d2e1c9ba945cf136d7e210840e38f28a2344536c9342fc9528a82b69977d1a",
  "6d3e499e6ee1008b1cb2370cfe066f55921a9482933619f64add0211b942a7f7",
  "9c4e614bf8ee110382a062a28b8b9dd93e44c62b47cd1cb0b4aafd8e977d4656",
  "8256a04bb3e519232e0db7da13ca80db31f9ce3dd829aac21ca5cef392df57c1",
  "05b29e6689cf5e57d8547f88a45137e2f315b6e519939cdc472300acc2044b27",
  "24b9f85c99a6425e4b85684db2bc3aed255731942e54f8c0b4f61b60397b07ab",
  "3e095fbb2893f52e286ac4a41506fd1ea8f9ad484d7c2a8a95932a0d6cfc9ead",
  "950b388bacb55ffe95c615774aee10a0627e330ec3f47872fa6baf7f84f3f70d",
  "292e2e184b149c4f045b64971250c78e07fb6ebbee7467a10e4dfd575d94cd45",
  "1a65c8c6d1d217b85f033cb2a12a91710f54d14e63e2fd3d2c94a42697c47a9f",
  "8abeae8425e4c56466108bbf839f804b805a822bfee4f2e22e32dbc84425dbad",
  "a595c73f5652302122edc400a67188712bda2869a474517a943d32c507b60619",
  "2adfb7985c70638dee76fa1acd2735e39ef384cd91ef8b3b83055781f4b9e075",
  "321f3e0902c4b7d0739a166ee589df978d51b260d2c62e29d2ab5a3bc563719c",
  "9765e9d25f102ff301d8d2b419adf48ebf94b929fed912bb0c872e107cd96a11",
  "febe21848f61067508a1d3c3975224dfd51fdfd1d4f35ddb252e046409064d97",
  "0514cc4a85438994f34e5687d698070eb898717658e14f12b93c1c4f7a6234cf",
  "af7a659ca770c968f40ef09f50c1efe98f9ea815efb4cc2d9e40957ea5853f45",
  "77ef9b5bf874ac09a9a463eb789d347a53547ce3746fed1dd116bc015ec01d13",
  "963d8c0ce37429f66cd350320c8878fc536c39b5766ae15895a9634136885e99",
  "e61be2311816f2c8e075034d81dc9756ba0fe3d314dbb313e0db770c753ae621",
  "b20109726238f9d5a22f38576136124e1d4b7d4c984da023600339ea57cef2d4",
  "f8eb6415e22d03bacee8d96f369cb6e6f1077a7d89843d57e13599b115fe2816",
  "de7fd568111f958a0ca4300b7d0d02770129d74b36d3458c4d41e6fa7927002a",
  "db888e5dcc84bda691bb2f0456fc50e69ac5f617c41666c39113e09747c1d99c",
  "f82da2d7baed8370035a17ff87aaf535e8ab403e269053ce9a96f42afc5d72c6",
  "ebe56da3d3654beaf5f1ea1d38d4f6176aea29fed407c66219aefc0ec7449d48",
  "d05e54ecd46c5f2b200e96e63b1f8c2417c70470efd3f09e1efac786e2525a03",
  "333bfee39570ee61853f389bdc388c770135e49d07d82bc2c8522bbd8751c33a",
  "f8ed85627c2e309f716a1e44e2faa06f05931fab084f08da200abdef19b3bd2c",
  "4fc75c07c80dd65740accf169a07d7345985b8c022a0be1d0c7379802eb9af2d",
  "c4683f33074c2fffc6a654b2cf809b5a8b71d63fb9de8559c03910c4d21365e3",
  "c99d3ec17f1b38cf43eaaa74d6c82545d8f7221adc888035177652b39904f9a2",
  "ee9db21ccbcc378fec8a599333697e6c5fbb19edd32a810ee104820b4350405f",
  "6f908551f761db008e11955efef9439b6a03511caf0aa7a0d30c6a18a73c912b",
  "e63c569cd58d2251a2e0002cefe9a536da06fa65a001c7a44216e04a3e892c95",
  "f279ebd4354d119f229e5ffcb1bc9ca09e58f181b47eb3d2a843c546476a3d64",
  "143233951517383d34e514a30aad83659c915b415ea62bb96536e0a1d55755fc",
  "dc92fec7e6889edac4db808d9f775c55f49856db3d82e34c09667f54a69b495b",
  "eb876a9360a9d429bad376abc68b2c22acda0fbe2a92355d56182c21e49ea1c3",
  "e21219942b06fbf6b01dcd36aa48d4f0cb6b0a1db6fe85b6d4ab49928d664e98",
  "87c0810a08765bccc9b26fc229f1451938c5544bc15cf84a47b8b7eed0347c53",
  "bdf6d479cb7e3b637679d5955e5e8f43c25e7182d1f36d426d052373d4d1b0c4",
  "ddb3196ce230a65dc8ce4835a0ba68da334f2116113e60794d0e06d72896956a",
  "87f6248f392f97be33693dce4e49739ecd58d4bff0c2ab9b823b40541251ece4",
  "e6707a55baaba39bdee700e2320aa0b02c0105f743b121f09349795c1be7f750",
  "4eabf08850c4f2a5f9e21e045b8201744e7338a9e74cfa3fb11b0d736f183bfa",
  "76e3ecf6d75e1d5a6b8bdfbc9e7b15add40635b9c6bda4ddafe9c3b3fe91ff20",
  "9563b5ef4326d728feb2d6b8ab2613793591d6f0cbd0daeb56ad48881bbff4ea",
  "2e93b02ce33b89e2b61ec80b344815b70292d014a247de231d53d67b135b8d80",
  "9146a86278d308a484ef2c879c776cc7f7056ea06d33f975241512bfa8c2b19f",
  "4482dee2364750c17694cf8a514ad4513a723924b37f23e95f25eaff59adcd5b",
  "9a0a7513a2fe40fb4b533d4b191877eac95c3942352e884d453a62d182d87ac2",
  "8c3547d49f289705898d9975b4ba6a7ccd0f54395f69786ea437a4114dd7a73b",
  "cfb3fd1a6d7a9df3e60b762919c27e6ba956b01559235a3808ef9d389a7b6cc5",
  "7e8fa3573927e2f2de779c597f89ac32951db3e412114e9b4c31bc6e2f1dc0f5",
  "25b93cdf55350c37ce65bc65cdba4d40f96884400577aeac2d1818516bfce232",
  "68e4c9b6a4254fd2fd7e39e4ba517089cfb237c1a2f174596b0a6526d8459a8a",
  "095e8b9a45d39442053db37d3802cf24e7825cd6ebce6d6bde1c1c8347a1034e",
  "8184b9f60cd684e20ae9b42c2faf9b6b83bfcd51f39bc3d2233cb56c885b121f",
  "d76c70254a0627183f6db3dddfa4d45538ff93da8bc773b7e0e7a869c8332092",
  "b8522b355426c3dad5add1c4d58dd3f3aca3b4346e2c13757c967d16e66c47e0",
  "7a92d66c55dbb89c73b36be461ea07bb38a88a4d3d243b100d1bf5bda2b88a23",
  "ba8db62175aaf4b37feaa23c1f0317a4ca23cbd46631330b1270450106f13cfe"
]);

async function _sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const License = (() => {

  function formatIsValid(key) {
    return LICENSE_FORMAT_RE.test((key || "").trim().toUpperCase());
  }

  async function isKeyValid(key) {
    const k = (key || "").trim().toUpperCase();
    if (!LICENSE_FORMAT_RE.test(k)) return false;
    const hash = await _sha256Hex(_LICENSE_SALT + k);
    return _LICENSE_HASHES.has(hash);
  }

  async function getActivation() {
    return await DB.get("license", "activation");
  }

  async function isActivated() {
    const rec = await getActivation();
    return !!(rec && rec.active && rec.license_key);
  }

  async function activate(key) {
    const k = (key || "").trim().toUpperCase();
    if (!k) return { ok: false, message: "Please enter a license key." };
    const valid = await isKeyValid(k);
    if (!valid) return { ok: false, message: "Invalid License Key" };
    const rec = {
      key: "activation",
      license_key: k,
      active: true,
      activated_at: new Date().toISOString()
    };
    await DB.put("license", rec);
    return { ok: true, message: "License Activated Successfully", record: rec };
  }

  async function deactivate() {
    await DB.put("license", { key: "activation", license_key: null, active: false, activated_at: null });
    return { ok: true, message: "License deactivated." };
  }

  return { formatIsValid, isKeyValid, getActivation, isActivated, activate, deactivate };
})();
