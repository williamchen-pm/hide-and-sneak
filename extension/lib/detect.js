/*
 * Hide & Sneak: detection core.
 * Pure functions, no DOM access. Loaded as a classic script in the extension
 * (exposes globalThis.HNSDetect) and via require() in Node tests.
 */
(function (root) {
  'use strict';

  // ---------- checksums ----------
  function luhnValid(digits) {
    let sum = 0, dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return digits.length > 0 && sum % 10 === 0;
  }

  function abaValid(d) {
    if (!/^\d{9}$/.test(d)) return false;
    const n = d.split('').map(Number);
    const s = 3 * (n[0] + n[3] + n[6]) + 7 * (n[1] + n[4] + n[7]) + (n[2] + n[5] + n[8]);
    return s % 10 === 0 && s > 0;
  }

  const onlyDigits = (s) => s.replace(/\D/g, '');

  // Vehicle identification number check digit (position 9).
  function vinValid(v) {
    v = v.toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return false;
    const T = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
    const W = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < 17; i++) { const c = v[i]; sum += (/\d/.test(c) ? +c : T[c]) * W[i]; }
    const r = sum % 11;
    return v[8] === (r === 10 ? 'X' : String(r));
  }

  // BIP39 English word list (2,048 words; SHA-256 of english.txt 2f5eed53…24dbda), used to spot
  // crypto wallet recovery phrases: 12+ words in a row, all from this list. Ordinary prose almost
  // never does that, because common words like "the", "and", "of", "is" aren't on the list.
  const BIP39 = new Set('abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis baby bachelor bacon badge bag balance balcony ball bamboo banana banner bar barely bargain barrel base basic basket battle beach bean beauty because become beef before begin behave behind believe below belt bench benefit best betray better between beyond bicycle bid bike bind biology bird birth bitter black blade blame blanket blast bleak bless blind blood blossom blouse blue blur blush board boat body boil bomb bone bonus book boost border boring borrow boss bottom bounce box boy bracket brain brand brass brave bread breeze brick bridge brief bright bring brisk broccoli broken bronze broom brother brown brush bubble buddy budget buffalo build bulb bulk bullet bundle bunker burden burger burst bus business busy butter buyer buzz cabbage cabin cable cactus cage cake call calm camera camp can canal cancel candy cannon canoe canvas canyon capable capital captain car carbon card cargo carpet carry cart case cash casino castle casual cat catalog catch category cattle caught cause caution cave ceiling celery cement census century cereal certain chair chalk champion change chaos chapter charge chase chat cheap check cheese chef cherry chest chicken chief child chimney choice choose chronic chuckle chunk churn cigar cinnamon circle citizen city civil claim clap clarify claw clay clean clerk clever click client cliff climb clinic clip clock clog close cloth cloud clown club clump cluster clutch coach coast coconut code coffee coil coin collect color column combine come comfort comic common company concert conduct confirm congress connect consider control convince cook cool copper copy coral core corn correct cost cotton couch country couple course cousin cover coyote crack cradle craft cram crane crash crater crawl crazy cream credit creek crew cricket crime crisp critic crop cross crouch crowd crucial cruel cruise crumble crunch crush cry crystal cube culture cup cupboard curious current curtain curve cushion custom cute cycle dad damage damp dance danger daring dash daughter dawn day deal debate debris decade december decide decline decorate decrease deer defense define defy degree delay deliver demand demise denial dentist deny depart depend deposit depth deputy derive describe desert design desk despair destroy detail detect develop device devote diagram dial diamond diary dice diesel diet differ digital dignity dilemma dinner dinosaur direct dirt disagree discover disease dish dismiss disorder display distance divert divide divorce dizzy doctor document dog doll dolphin domain donate donkey donor door dose double dove draft dragon drama drastic draw dream dress drift drill drink drip drive drop drum dry duck dumb dune during dust dutch duty dwarf dynamic eager eagle early earn earth easily east easy echo ecology economy edge edit educate effort egg eight either elbow elder electric elegant element elephant elevator elite else embark embody embrace emerge emotion employ empower empty enable enact end endless endorse enemy energy enforce engage engine enhance enjoy enlist enough enrich enroll ensure enter entire entry envelope episode equal equip era erase erode erosion error erupt escape essay essence estate eternal ethics evidence evil evoke evolve exact example excess exchange excite exclude excuse execute exercise exhaust exhibit exile exist exit exotic expand expect expire explain expose express extend extra eye eyebrow fabric face faculty fade faint faith fall false fame family famous fan fancy fantasy farm fashion fat fatal father fatigue fault favorite feature february federal fee feed feel female fence festival fetch fever few fiber fiction field figure file film filter final find fine finger finish fire firm first fiscal fish fit fitness fix flag flame flash flat flavor flee flight flip float flock floor flower fluid flush fly foam focus fog foil fold follow food foot force forest forget fork fortune forum forward fossil foster found fox fragile frame frequent fresh friend fringe frog front frost frown frozen fruit fuel fun funny furnace fury future gadget gain galaxy gallery game gap garage garbage garden garlic garment gas gasp gate gather gauge gaze general genius genre gentle genuine gesture ghost giant gift giggle ginger giraffe girl give glad glance glare glass glide glimpse globe gloom glory glove glow glue goat goddess gold good goose gorilla gospel gossip govern gown grab grace grain grant grape grass gravity great green grid grief grit grocery group grow grunt guard guess guide guilt guitar gun gym habit hair half hammer hamster hand happy harbor hard harsh harvest hat have hawk hazard head health heart heavy hedgehog height hello helmet help hen hero hidden high hill hint hip hire history hobby hockey hold hole holiday hollow home honey hood hope horn horror horse hospital host hotel hour hover hub huge human humble humor hundred hungry hunt hurdle hurry hurt husband hybrid ice icon idea identify idle ignore ill illegal illness image imitate immense immune impact impose improve impulse inch include income increase index indicate indoor industry infant inflict inform inhale inherit initial inject injury inmate inner innocent input inquiry insane insect inside inspire install intact interest into invest invite involve iron island isolate issue item ivory jacket jaguar jar jazz jealous jeans jelly jewel job join joke journey joy judge juice jump jungle junior junk just kangaroo keen keep ketchup key kick kid kidney kind kingdom kiss kit kitchen kite kitten kiwi knee knife knock know lab label labor ladder lady lake lamp language laptop large later latin laugh laundry lava law lawn lawsuit layer lazy leader leaf learn leave lecture left leg legal legend leisure lemon lend length lens leopard lesson letter level liar liberty library license life lift light like limb limit link lion liquid list little live lizard load loan lobster local lock logic lonely long loop lottery loud lounge love loyal lucky luggage lumber lunar lunch luxury lyrics machine mad magic magnet maid mail main major make mammal man manage mandate mango mansion manual maple marble march margin marine market marriage mask mass master match material math matrix matter maximum maze meadow mean measure meat mechanic medal media melody melt member memory mention menu mercy merge merit merry mesh message metal method middle midnight milk million mimic mind minimum minor minute miracle mirror misery miss mistake mix mixed mixture mobile model modify mom moment monitor monkey monster month moon moral more morning mosquito mother motion motor mountain mouse move movie much muffin mule multiply muscle museum mushroom music must mutual myself mystery myth naive name napkin narrow nasty nation nature near neck need negative neglect neither nephew nerve nest net network neutral never news next nice night noble noise nominee noodle normal north nose notable note nothing notice novel now nuclear number nurse nut oak obey object oblige obscure observe obtain obvious occur ocean october odor off offer office often oil okay old olive olympic omit once one onion online only open opera opinion oppose option orange orbit orchard order ordinary organ orient original orphan ostrich other outdoor outer output outside oval oven over own owner oxygen oyster ozone pact paddle page pair palace palm panda panel panic panther paper parade parent park parrot party pass patch path patient patrol pattern pause pave payment peace peanut pear peasant pelican pen penalty pencil people pepper perfect permit person pet phone photo phrase physical piano picnic picture piece pig pigeon pill pilot pink pioneer pipe pistol pitch pizza place planet plastic plate play please pledge pluck plug plunge poem poet point polar pole police pond pony pool popular portion position possible post potato pottery poverty powder power practice praise predict prefer prepare present pretty prevent price pride primary print priority prison private prize problem process produce profit program project promote proof property prosper protect proud provide public pudding pull pulp pulse pumpkin punch pupil puppy purchase purity purpose purse push put puzzle pyramid quality quantum quarter question quick quit quiz quote rabbit raccoon race rack radar radio rail rain raise rally ramp ranch random range rapid rare rate rather raven raw razor ready real reason rebel rebuild recall receive recipe record recycle reduce reflect reform refuse region regret regular reject relax release relief rely remain remember remind remove render renew rent reopen repair repeat replace report require rescue resemble resist resource response result retire retreat return reunion reveal review reward rhythm rib ribbon rice rich ride ridge rifle right rigid ring riot ripple risk ritual rival river road roast robot robust rocket romance roof rookie room rose rotate rough round route royal rubber rude rug rule run runway rural sad saddle sadness safe sail salad salmon salon salt salute same sample sand satisfy satoshi sauce sausage save say scale scan scare scatter scene scheme school science scissors scorpion scout scrap screen script scrub sea search season seat second secret section security seed seek segment select sell seminar senior sense sentence series service session settle setup seven shadow shaft shallow share shed shell sheriff shield shift shine ship shiver shock shoe shoot shop short shoulder shove shrimp shrug shuffle shy sibling sick side siege sight sign silent silk silly silver similar simple since sing siren sister situate six size skate sketch ski skill skin skirt skull slab slam sleep slender slice slide slight slim slogan slot slow slush small smart smile smoke smooth snack snake snap sniff snow soap soccer social sock soda soft solar soldier solid solution solve someone song soon sorry sort soul sound soup source south space spare spatial spawn speak special speed spell spend sphere spice spider spike spin spirit split spoil sponsor spoon sport spot spray spread spring spy square squeeze squirrel stable stadium staff stage stairs stamp stand start state stay steak steel stem step stereo stick still sting stock stomach stone stool story stove strategy street strike strong struggle student stuff stumble style subject submit subway success such sudden suffer sugar suggest suit summer sun sunny sunset super supply supreme sure surface surge surprise surround survey suspect sustain swallow swamp swap swarm swear sweet swift swim swing switch sword symbol symptom syrup system table tackle tag tail talent talk tank tape target task taste tattoo taxi teach team tell ten tenant tennis tent term test text thank that theme then theory there they thing this thought three thrive throw thumb thunder ticket tide tiger tilt timber time tiny tip tired tissue title toast tobacco today toddler toe together toilet token tomato tomorrow tone tongue tonight tool tooth top topic topple torch tornado tortoise toss total tourist toward tower town toy track trade traffic tragic train transfer trap trash travel tray treat tree trend trial tribe trick trigger trim trip trophy trouble truck true truly trumpet trust truth try tube tuition tumble tuna tunnel turkey turn turtle twelve twenty twice twin twist two type typical ugly umbrella unable unaware uncle uncover under undo unfair unfold unhappy uniform unique unit universe unknown unlock until unusual unveil update upgrade uphold upon upper upset urban urge usage use used useful useless usual utility vacant vacuum vague valid valley valve van vanish vapor various vast vault vehicle velvet vendor venture venue verb verify version very vessel veteran viable vibrant vicious victory video view village vintage violin virtual virus visa visit visual vital vivid vocal voice void volcano volume vote voyage wage wagon wait walk wall walnut want warfare warm warrior wash wasp waste water wave way wealth weapon wear weasel weather web wedding weekend weird welcome west wet whale what wheat wheel when where whip whisper wide width wife wild will win window wine wing wink winner winter wire wisdom wise wish witness wolf woman wonder wood wool word work world worry worth wrap wreck wrestle wrist write wrong yard year yellow you young youth zebra zero zone zoo'.split(' '));
  function isBip39(w) { return BIP39.has(String(w).toLowerCase()); }
  // Runs of 12+ list words, allowing numbering ("1. abandon 2) ability"), commas, and line breaks
  // between them. Returns [[start, end], ...].
  function seedRuns(text) {
    const out = [], re = /[A-Za-z]{3,8}/g;
    let m, runStart = -1, runEnd = -1, count = 0, lastEnd = 0;
    const close = () => { if (count >= 12) out.push([runStart, runEnd]); count = 0; runStart = -1; };
    while ((m = re.exec(text)) !== null) {
      const gap = text.slice(lastEnd, m.index);
      const joined = count > 0 && /^(?:[\s,;•·|]|\d{1,2}[.):]?)*$/.test(gap);
      const wordOk = isBip39(m[0]) && !/[A-Za-z]/.test(text[m.index + m[0].length] || '') && !/[A-Za-z]/.test(text[m.index - 1] || '');
      if (wordOk) { if (!joined) { close(); runStart = m.index; } count++; runEnd = m.index + m[0].length; }
      else close();
      lastEnd = m.index + m[0].length;
    }
    close();
    return out;
  }

  // ---------- pattern rules ----------
  // Each rule: { id, pack, token, re (global, with `d` flag), group (capture group to redact; 0 = whole), check(value) }
  const RULES = [
    // Identity
    { id: 'ssn-formatted', pack: 'identity', token: '[SSN]', group: 1,
      re: /(?<![\d-])((?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4})(?![\d-])/dg },
    { id: 'ssn-keyword', pack: 'identity', token: '[SSN]', group: 1,
      re: /(?:\bSSN\b|social\s+security(?:\s+(?:number|no\.?|#))?|\bTIN\b|\bITIN\b)[\s:#.\-]{0,12}((?!000|666|9\d\d)\d{3}-?\d{2}-?\d{4})(?!\d)/dgi },
    { id: 'dob-keyword', pack: 'identity', token: '[DATE OF BIRTH]', group: 1,
      re: /(?:date\s+of\s+birth|\bDOB\b|\bborn(?:\s+on)?\b|birth\s*date|birthday)[\s:.\-]{0,12}((?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}))/dgi },
    { id: 'ein-keyword', pack: 'identity', token: '[TAX ID]', group: 1,
      re: /(?:\bEIN\b|\bFEIN\b|employer\s+identification(?:\s+(?:number|no\.?))?|federal\s+tax\s+id(?:entification)?(?:\s+(?:number|no\.?))?|\btax\s+id(?:\s+(?:number|no\.?))?)[\s:#.\-]{0,12}(\d{2}-?\d{7})(?!\d)/dgi },
    { id: 'uk-nino', pack: 'identity', token: '[ID NUMBER]', group: 1,
      re: /(?<![A-Za-z0-9])((?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D])(?![A-Za-z0-9])/dg },
    { id: 'ca-sin', pack: 'identity', token: '[ID NUMBER]', group: 1,
      re: /(?:\bSIN\b|[Ss]ocial\s+[Ii]nsurance(?:\s+(?:[Nn]umber|[Nn]o\.?))?)[\s:#.\-]{0,12}(\d{3}[ -]?\d{3}[ -]?\d{3})(?!\d)/dg,
      check: (v) => luhnValid(onlyDigits(v)) },
    { id: 'vin', pack: 'identity', token: '[VIN]', group: 1,
      re: /\b(?:VIN|vehicle\s+identification)(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,8}([A-HJ-NPR-Z0-9]{17})\b/dgi, check: vinValid },

    // Health & insurance
    { id: 'medicare-mbi', pack: 'health', token: '[HEALTH ID]', group: 1,
      re: /(?<![A-Za-z0-9])([1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d-[AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d-[AC-HJKMNP-RT-Y]{2}\d{2})(?![A-Za-z0-9])/dg },
    { id: 'medicare-keyword', pack: 'health', token: '[HEALTH ID]', group: 1,
      re: /(?:medicare(?:\s+(?:number|no\.?|#|id))?|\bMBI\b|medicaid(?:\s+(?:number|no\.?|#|id))?)[\s:#.\-]{0,12}([A-Z0-9][A-Z0-9-]{7,15})\b/dgi, check: (v) => /\d/.test(v) },
    { id: 'health-member-id', pack: 'health', token: '[HEALTH ID]', group: 1,
      re: /(?:member|subscriber|policy(?:holder)?|insurance|group|plan)\s*(?:id|identification|number|no\.?|#)(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,8}([A-Z0-9][A-Z0-9-]{4,19})\b/dgi,
      check: (v) => /\d/.test(v) && !/^\d{1,4}$/.test(v) },
    { id: 'mrn', pack: 'health', token: '[HEALTH ID]', group: 1,
      re: /(?:\bMRN\b|medical\s+record(?:\s+(?:number|no\.?|#))?|patient\s+(?:id|number|no\.?|#))[\s:#.\-]{0,8}([A-Z0-9][A-Z0-9-]{4,15})\b/dgi, check: (v) => /\d/.test(v) },

    { id: 'passport-keyword', pack: 'identity', token: '[ID NUMBER]', group: 1,
      re: /(?:passport|driver'?s?\s+licen[cs]e|\bDL\b)(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,12}([A-Z0-9]{6,12})\b/dgi,
      check: (v) => /\d/.test(v) },

    // Payments
    { id: 'card', pack: 'payments', token: '[CARD #]', group: 1,
      re: /(?<![\d-])([2-6]\d{3}(?:[ -]?\d{3,4}){2,4}(?:[ -]?\d{1,3})?)(?![\d-])/dg,
      check: (v) => { const d = onlyDigits(v); return d.length >= 13 && d.length <= 19 && luhnValid(d); } },
    { id: 'card-amex', pack: 'payments', token: '[CARD #]', group: 1,
      re: /(?<![\d-])(3[47]\d{2}[ -]?\d{6}[ -]?\d{5})(?![\d-])/dg,
      check: (v) => luhnValid(onlyDigits(v)) },
    { id: 'card-expiry', pack: 'payments', token: '[CARD EXPIRY]', group: 1,
      re: /\b(?:exp(?:iry|iration|ires)?(?:\s+date)?\.?|valid\s+thru)[\s:]{0,4}((?:0[1-9]|1[0-2])\s?\/\s?(?:\d{4}|\d{2}))(?!\d)/dgi },
    { id: 'cvv-keyword', pack: 'payments', token: '[CVV]', group: 1,
      re: /(?:\bCVV2?\b|\bCVC2?\b|\bCID\b|security\s+code)[\s:#.\-]{0,8}(\d{3,4})(?!\d)/dgi },
    { id: 'routing-keyword', pack: 'payments', token: '[ROUTING #]', group: 1,
      re: /(?:routing(?:\s+(?:number|no\.?|#))?|\bABA\b|\bRTN\b)[\s:#.\-]{0,12}(\d{9})(?!\d)/dgi,
      check: abaValid },
    { id: 'account-keyword', pack: 'payments', token: '[ACCOUNT #]', group: 1,
      re: /(?:\baccount|\bacct)\.?(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,12}((?:\d[ -]?){5,16}\d)(?![\d])/dgi },
    { id: 'iban', pack: 'payments', token: '[ACCOUNT #]', group: 1,
      re: /\b([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?)\b/dg },

    // Credentials
    { id: 'otp-before', pack: 'credentials', token: '[2FA CODE]', group: 1,
      re: /(?:(?:verification|security|login|log[- ]in|sign[- ]?in|one[- ]time|confirmation|access|auth(?:entication)?|2FA|MFA)\s+(?:code|passcode|PIN)|\bOTP\b|\bpasscode\b|\byour\s+code)(?:\s+is)?[\s:#]{0,6}(\d{4,8}|\d{3}[ -]\d{3})(?!\d)/dgi },
    { id: 'otp-after', pack: 'credentials', token: '[2FA CODE]', group: 1,
      re: /(?<!\d)(\d{4,8}|\d{3}[ -]\d{3})\s+is\s+your\s+(?:[\w-]+\s+){0,3}(?:code|passcode|OTP|PIN)\b/dgi },

    { id: 'password-keyword', pack: 'credentials', token: '[PASSWORD]', group: 1,
      // Requires "is" or a colon, so "Forgot your password? Click here" is left alone.
      re: /(?:\b(?:temporary\s+|new\s+|one[- ]time\s+|wi-?fi\s+)?(?:password|passphrase)\b)(?:\s+is\s*:?|\s*:)\s*([^\s<>"']{4,64})/dgi },
    { id: 'pin-keyword', pack: 'credentials', token: '[PIN]', group: 1,
      re: /\bPIN\b(?:\s+(?:is|number|code))?(?:\s+is)?[\s:#]{0,4}(\d{4,8})(?!\d)/dg },
    { id: 'api-key', pack: 'credentials', token: '[API KEY]', group: 1,
      re: /\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{22,}|sk-(?:proj-|ant-(?:api\d+-)?|live-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,})/dg },
    { id: 'seed-phrase', pack: 'credentials', token: '[RECOVERY PHRASE]', find: seedRuns },
    { id: 'security-answer', pack: 'credentials', token: '[SECURITY ANSWER]', group: 1,
      re: /(?:security\s+(?:question\s+)?answer|secret\s+answer|answer\s+to\s+(?:your\s+)?security\s+question|memorable\s+(?:word|answer))\s*(?:is\s*:?|:)\s*([^\s<>.][^\n<>.]{0,40}?)(?=\s*(?:[.\n<]|$))/dgi },
    { id: 'license-key', pack: 'credentials', token: '[LICENSE KEY]', group: 1,
      re: /(?<![A-Za-z0-9-])([A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}|[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3,5})(?![A-Za-z0-9-])/dg,
      check: (v) => /\d/.test(v) && /[A-Z]/.test(v) && !/^\d{4}(?:-\d{4})+$/.test(v) },
    { id: 'private-key', pack: 'credentials', token: '[PRIVATE KEY]', group: 1,
      re: /(-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----|$))/dg },
    { id: 'login-link', pack: 'credentials', token: '[LOGIN LINK]', group: 1,
      // One-time login / reset / verification links: a token-like query parameter, or a long
      // opaque path segment after /magic, /reset, /verify, /confirm, /login, /signin.
      re: /(\bhttps?:\/\/[^\s"'<>]*?(?:[?&#](?:token|reset_token|login_token|access_token|auth_token|magic|otp|code|key|signature|sig)=[A-Za-z0-9._~%-]{8,}|\/(?:magic|reset|verify|confirm|login|signin|sign-in|auth)[\w-]*\/[A-Za-z0-9_-]{16,})[^\s"'<>]*)/dgi },

    // Last 4 digits of cards/accounts (opt-in: agents often need these to pick the right one)
    { id: 'last4-ending', pack: 'last4', token: '[LAST 4]', group: 1,
      re: /\b(?:ending(?:\s+in)?|ends\s+in|last\s+(?:4|four)(?:\s+digits)?)[\s:#]{0,4}(\d{4})(?!\d)/dgi },
    { id: 'last4-masked', pack: 'last4', token: '[LAST 4]', group: 1,
      re: /(?:[•*●·xX]{2,}[\s-]?|\.{3}\s?)(\d{4})(?!\d)/dg },
    { id: 'last4-label', pack: 'last4', token: '[LAST 4]', group: 1,
      re: /\b(?:checking|savings|account|acct|card|visa|mastercard|amex|american\s+express|discover|debit|credit)\b[^\n\d]{0,16}?[-–—]\s?(\d{4})(?!\d)/dgi },

    // Crypto wallet addresses (off by default: they're public, and an agent sending crypto needs them)
    { id: 'wallet-eth', pack: 'crypto', token: '[WALLET]', group: 1, re: /(?<![A-Za-z0-9])(0x[a-fA-F0-9]{40})(?![A-Za-z0-9])/dg },
    { id: 'wallet-btc', pack: 'crypto', token: '[WALLET]', group: 1,
      re: /(?<![A-Za-z0-9])(bc1[ac-hj-np-z02-9]{25,59}|(?<=(?:bitcoin|btc|wallet)\b[^\n]{0,20})[13][a-km-zA-HJ-NP-Z1-9]{25,34})(?![A-Za-z0-9])/dgi },

    // Balances (off by default: agents often need to see amounts)
    { id: 'balance', pack: 'balances', token: '[BALANCE]', group: 1,
      re: /\b(?:(?:available|current|account|statement|ending|outstanding|total|cash|checking|savings|portfolio|wallet|new|remaining)\s+)?balance(?:\s+(?:due|of))?\s*(?:is\s*)?[:\s]\s*(-?\s?(?:[$€£]|USD\s?)\s?-?\d[\d,]*(?:\.\d{2})?)/dgi },

    // Contact (off by default)
    { id: 'phone-us', pack: 'contact', token: '[PHONE]', group: 1,
      re: /(?<![\d-])((?:\+?1[ .-]?)?(?:\(\d{3}\)\s?|\d{3}[ .-])\d{3}[ .-]\d{4})(?![\d-])/dg },
    { id: 'email', pack: 'contact', token: '[EMAIL]', group: 1,
      re: /(?<![\w.%+-])([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/dg },
    { id: 'street-address', pack: 'contact', token: '[ADDRESS]', group: 1,
      re: /\b(\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-zA-Z]+\s+){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court|Pl|Place|Ter|Terrace|Cir|Circle|Pkwy|Parkway|Hwy|Highway)\.?(?:,?\s+(?:Apt|Unit|Suite|Ste|#)\.?\s*[A-Za-z0-9-]+)?)\b/dg },

    // Job applications
    { id: 'salary-keyword', pack: 'job', token: '[SALARY]', group: 1,
      re: /(?:salary|compensation|base\s+pay|pay\s+(?:rate|expectation)s?|desired\s+pay|wage|annual\s+pay)[^.\n]{0,40}?(\$\s?\d[\d,]*(?:\.\d{2})?\s*(?:k|K)?(?:\s*(?:-|to|–)\s*\$?\s?\d[\d,]*(?:\.\d{2})?\s*(?:k|K)?)?)/dgi },
  ];

  const PLACEHOLDER_RE = /^\s*(?:\[[A-Z0-9 #]+\]\s*)+$/;

  const DEFAULT_PACKS = { identity: true, payments: true, credentials: true, health: true, contact: false, job: true, last4: false, crypto: false, balances: false, injection: true };

  function enabledRules(packs, extraRules) {
    const p = Object.assign({}, DEFAULT_PACKS, packs || {});
    return RULES.filter(r => p[r.pack]).concat(extraRules || []);
  }

  /** Find non-overlapping matches. Returns [{start, end, token, ruleId, pack}] sorted by start. */
  function findMatches(text, packs, extraRules) {
    if (!text || text.length < 3) return [];
    // Cheap pre-check: most text has none of these cues, so skip the full rule set.
    if (!(extraRules && extraRules.length) && !/\d|@|pass|key|token|BEGIN|eyJ|xox|http|answer|[A-Za-z]{3,8}(?:[\s,]+[A-Za-z]{3,8}){11}/i.test(text)) return [];
    const hits = [];
    for (const r of enabledRules(packs, extraRules)) {
      if (r.find) { for (const [start, end] of r.find(text)) hits.push({ start, end, token: r.token, ruleId: r.id, pack: r.pack }); continue; }
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(text)) !== null) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        const g = r.group || 0;
        const value = m[g];
        if (value == null) continue;
        if (r.check && !r.check(value)) continue;
        // Never re-match our own placeholders (e.g. "password is: [PASSWORD]"), or a rule could
        // keep replacing its own output forever.
        if (PLACEHOLDER_RE.test(value)) continue;
        const [start, end] = m.indices[g];
        hits.push({ start, end, token: r.token, ruleId: r.id, pack: r.pack });
      }
    }
    hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const out = [];
    let lastEnd = -1;
    for (const h of hits) { if (h.start >= lastEnd) { out.push(h); lastEnd = h.end; } }
    return out;
  }

  /** Replace matches with tokens. Returns { text, hits }. */
  function redactText(text, packs, extraRules) {
    const hits = findMatches(text, packs, extraRules);
    if (!hits.length) return { text, hits };
    let out = '', i = 0;
    for (const h of hits) { out += text.slice(i, h.start) + h.token; i = h.end; }
    return { text: out + text.slice(i), hits };
  }

  /** Build keyword rules from user phrases (case-insensitive, whole-phrase). */
  // User phrases (typed in Rules, or added with right-click "Hide this"). Word boundaries only
  // where the phrase starts/ends with a letter or digit, so "$4,213.55" or "(555) 010-2231" match
  // too, and any run of whitespace in the phrase matches any whitespace on the page.
  function keywordRules(phrases) {
    return (phrases || []).map(p => String(p || '').trim()).filter(p => p.length >= 2).map((p, i) => {
      const body = p.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      const pre = /^[\p{L}\p{N}_]/u.test(p) ? '(?<![\\p{L}\\p{N}_])' : '';
      const post = /[\p{L}\p{N}_]$/u.test(p) ? '(?![\\p{L}\\p{N}_])' : '';
      return { id: 'keyword-' + i, pack: 'keyword', token: '[PROTECTED]', group: 0, re: new RegExp(pre + body + post, 'dgiu') };
    });
  }

  // ---------- context-aware matching (value and its label live in different elements) ----------
  // Real emails often split "Enter this code:" and "826774" into separate blocks, so the
  // single-text-node patterns above never see both. These rules look at a standalone value
  // plus the text that precedes it on the page.
  const CONTEXT_RULES = [
    // Backup / recovery codes: usually a list (table or bullets) of mixed letters and digits under
    // a "Backup codes" heading. `list: true` lets earlier codes we've already hidden stay part of
    // the context, so every code in the list gets matched, not just the first.
    { id: 'backup-codes', pack: 'credentials', token: '[BACKUP CODE]', list: true,
      value: /^(?=[^\s]*\d)[A-Za-z0-9]{4,}(?:[- ][A-Za-z0-9]{3,}){0,3}$/,
      context: /\b(?:backup|recovery|scratch|emergency|one[- ]time)\s+(?:codes?|keys?)\b[^.!?]{0,40}$/i },
    { id: 'otp-context', pack: 'credentials', token: '[2FA CODE]',
      value: /^(?:\d{4,8}|\d{3}[ -]\d{3})$/,
      // The keyword can be one short sentence back, as long as that sentence introduces the value
      // with a colon ("…enter this code to finish signing in. It expires in 10 minutes:").
      context: /\b(?:code|passcode|OTP|PIN|verification|verify|one[- ]time|log[- ]?in|sign[- ]?in|2FA|MFA|authenticat\w*)\b[^.]{0,120}(?:\.\s+[^.]{0,60}:\s*)?$/i },
    { id: 'ssn-context', pack: 'identity', token: '[SSN]',
      value: /^(?!000|666|9\d\d)\d{3}-?\d{2}-?\d{4}$/,
      context: /(?:\bSSN\b|social\s+security(?:\s+(?:number|no\.?|#))?|\bTIN\b)[\s:#.\-]{0,20}$/i },
    { id: 'routing-context', pack: 'payments', token: '[ROUTING #]', check: (v) => abaValid(v), list: true,
      // Banks list several (e.g. "paper & electronic", then "wires"); the ABA checksum keeps this safe.
      value: /^\d{9}$/,
      context: /(?:routing|\bABA\b|\bRTN\b|\bwires?\b|transit)[^.!?]{0,120}$/i },
    { id: 'account-context', pack: 'payments', token: '[ACCOUNT #]',
      value: /^(?:\d[ -]?){5,16}\d$/,
      context: /(?:\baccount|\bacct)\.?(?:\s+(?:number|no\.?|#))?[\s:#.\-]{0,20}$/i },
    { id: 'account-context-near', pack: 'payments', token: '[ACCOUNT #]', list: true,
      // Longer numbers (8+ digits) with "account" nearby, allowing helper text in between
      // (e.g. a hidden "Your full account number is" or a "Show/Hide" link).
      value: /^(?:\d[ -]?){7,16}\d$/,
      context: /(?:\baccount|\bacct)\b[^.!?]{0,80}$/i },
  ];

  /**
   * value: the full (trimmed) text of a standalone text node.
   * precedingText: up to ~200 chars of page text just before it.
   * Returns { token, ruleId, pack } or null.
   */
  function contextMatch(value, precedingText, packs) {
    const p = Object.assign({}, DEFAULT_PACKS, packs || {});
    let v = (value || '').trim();
    if (!v || v.length > 24) return null;
    // Codes written with a space between every digit ("1 3 0 1 7 3", e.g. Gmail's aria-label).
    if (/^\d(?:\s\d){3,7}$/.test(v)) v = v.replace(/\s/g, '');
    const raw = (precedingText || '').replace(/\s+/g, ' ');
    // Normally only the text after the last placeholder we inserted counts as context for this value.
    const ctxSingle = raw.split(/\[[A-Z0-9 #]+\]/).pop().trim().slice(-200);
    for (const r of CONTEXT_RULES) {
      if (!p[r.pack] || v.length < 6 && r.list || !r.value.test(v)) continue;
      // List rules look past earlier items of the same list (already replaced with this rule's token).
      const ctx = r.list ? raw.split(r.token).join(' ').split(/\[[A-Z0-9 #]+\]/).pop().replace(/\s+/g, ' ').trim().slice(-200) : ctxSingle;
      if (r.check && !r.check(v.replace(/\D/g, ''))) continue;
      if (r.context.test(ctx)) return { token: r.token, ruleId: r.id, pack: r.pack };
    }
    return null;
  }

  // ---------- form field classification ----------
  const FIELD_AUTOCOMPLETE = {
    'cc-number': 'payments', 'cc-csc': 'payments', 'cc-exp': 'payments', 'cc-exp-month': 'payments', 'cc-exp-year': 'payments',
    'current-password': 'credentials', 'new-password': 'credentials', 'one-time-code': 'credentials',
    'bday': 'identity', 'bday-day': 'identity', 'bday-month': 'identity', 'bday-year': 'identity',
  };
  const FIELD_TEXT_RULES = [
    { pack: 'credentials', label: 'password or code', re: /\bpass(?:word|code|phrase)\b|\bOTP\b|one[- ]time\s+(?:code|password)|verification\s+code|2fa|two[- ]factor|\bmfa\b/i },
    { pack: 'payments', label: 'payment card', re: /card\s*(?:number|no\b|#)|credit\s*card|debit\s*card|\bcvv2?\b|\bcvc\b|security\s+code|expir(?:y|ation)\s+date/i },
    { pack: 'payments', label: 'bank account', re: /routing\s*(?:number|no\b|#)?|bank\s+account|account\s*(?:number|no\b|#)|\biban\b|\bswift\b|\bbic\b/i },
    { pack: 'credentials', label: 'security question', re: /security\s+(?:question|answer)|secret\s+(?:question|answer)|memorable\s+(?:word|answer)|mother'?s\s+maiden/i },
    { pack: 'credentials', label: 'PIN', re: /\bPIN\b/ },
    { pack: 'credentials', label: 'wallet recovery phrase', re: /seed\s+phrase|recovery\s+phrase|secret\s+recovery|mnemonic|wallet\s+(?:seed|backup)|private\s+key/i },
    { pack: 'identity', label: 'SSN or tax ID', re: /social\s+security|\bssn\b|\btin\b|\bitin\b|tax(?:payer)?\s+id|\bf?ein\b|employer\s+identification|social\s+insurance|\bsin\b|national\s+insurance|\bnino\b/i },
    { pack: 'health', label: 'health insurance ID', re: /member\s*(?:id|number|#)|subscriber\s*(?:id|number)|group\s*(?:number|no\b|#)|policy\s*(?:number|no\b|#)|insurance\s*(?:id|number)|medicare|medicaid|\bmbi\b|\bmrn\b|medical\s+record/i },
    { pack: 'identity', label: 'date of birth', re: /date\s+of\s+birth|\bdob\b|birth\s*date|birthday/i },
    { pack: 'identity', label: 'government ID', re: /passport|driver'?s?\s+licen[cs]e|national\s+id|government[- ]issued\s+id/i },
    { pack: 'job', label: 'demographic question', re: /\bgender\b|\bsex\b|\brace\b|ethnicit|hispanic|latin[oax]|veteran|disabilit|sexual\s+orientation|transgender|self[- ]identif|\beeo\b|equal\s+employment/i },
    { pack: 'job', label: 'salary question', re: /salary|compensation|pay\s+(?:expectation|requirement|rate)|desired\s+pay|expected\s+pay|current\s+pay|\bwage/i },
    { pack: 'job', label: 'background check consent', re: /background\s+check|criminal\s+(?:history|record|background)|\bconvicted\b|consumer\s+report/i },
    { pack: 'job', label: 'legal attestation', re: /\bi\s+(?:hereby\s+)?(?:certify|attest|acknowledge|affirm|agree)|electronic\s+signature|e-?signature|type\s+your\s+(?:full\s+)?name\s+to\s+sign|arbitrat/i },
  ];

  /**
   * Classify a form field from its metadata.
   * meta: { type, autocomplete, name, id, labelText }
   * Returns { pack, label, reason } or null.
   */
  function classifyField(meta, packs) {
    const p = Object.assign({}, DEFAULT_PACKS, packs || {});
    const type = (meta.type || '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'image' || type === 'reset') return null;
    if (type === 'password' && p.credentials) return { pack: 'credentials', label: 'password', reason: 'type=password' };
    const ac = (meta.autocomplete || '').toLowerCase().split(/\s+/).pop();
    if (ac && FIELD_AUTOCOMPLETE[ac] && p[FIELD_AUTOCOMPLETE[ac]]) {
      return { pack: FIELD_AUTOCOMPLETE[ac], label: ac, reason: 'autocomplete=' + ac };
    }
    const nameish = [meta.name, meta.id].filter(Boolean).join(' ').replace(/[_\-.\[\]]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    for (const src of [['label', meta.labelText || ''], ['name/id', nameish]]) {
      for (const r of FIELD_TEXT_RULES) {
        if (p[r.pack] && r.re.test(src[1])) return { pack: r.pack, label: r.label, reason: src[0] + ' matches "' + r.label + '"' };
      }
    }
    return null;
  }

  // ---------- URL pattern matching for page rules ----------
  /** Match a URL against a pattern like "https://www.amazon.com/cpe/yourpayments/*" or "*://bank.com/statements*". */
  function urlMatches(pattern, url) {
    if (!pattern) return false;
    const esc = pattern.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + esc + '$', 'i').test(url);
  }

  // ---------- injection shield: instructions aimed at AI agents ----------
  // The usual reason an agent would "go around the page" (run its own scripts, read network
  // traffic, open another site) is that the page told it to. Text like that is removed before
  // the agent reads it. Strong patterns apply anywhere; weaker ones only to text a person can't
  // see (display:none, off-screen, 1px, transparent) or to attributes.
  const INJECTION_TOKEN = '[AGENT INSTRUCTIONS REMOVED]';
  const AI = '(?:ai|a\\.i\\.|llms?|(?:large )?language models?|ai (?:assistant|agent|model|system)s?|(?:browser|automated|autonomous|web) agents?|claude|chatgpt|gpt-?\\d[\\w.-]*|gemini|copilot)';
  const INJ_STRONG = [
    /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+|any\s+|the\s+|of\s+)*(?:your\s+|my\s+|these\s+|those\s+)?(?:previous|prior|above|earlier|preceding|original|system|existing)\s+(?:instructions?|prompts?|directions|directives|rules|guidelines|messages?|context)/i,
    new RegExp('\\b(?:attention|note|message|instructions?|notice|reminder|important)\\s*(?:to|for)\\s+(?:any\\s+|all\\s+|the\\s+)?' + AI + '\\b', 'i'),
    new RegExp('\\b(?:if you are|you are|you\'re|as)\\s+an?\\s+' + AI + '\\b[^.!?\\n]{0,100}\\b(?:must|should|need to|are required|do not|don\'t|ignore|instead|now|have to|will)\\b', 'i'),
    new RegExp('\\b(?:dear|hey|hi|hello|attention)\\s+' + AI + '\\b', 'i'),
    new RegExp('(?:^|[.!?\\n]\\s*)(?:to\\s+)?(?:any\\s+|all\\s+|the\\s+)?' + AI + '\\s*[:,\\u2014-]\\s*(?:please\\s+)?(?:ignore|disregard|forward|send|open|go|navigate|visit|click|run|execute|reply|tell|reveal|copy|paste|approve|transfer|do not|don\'t|you must|you should|you need)\\b', 'i'),
    /<\|?(?:im_start|im_end|endoftext|system)\|?>|\[\/?INST\]|<\/?(?:system|instructions?|system_prompt)>/i,
    /\b(?:do not|don't|never|without)\s+(?:tell(?:ing)?|inform(?:ing)?|alert(?:ing)?|notify(?:ing)?|warn(?:ing)?|ask(?:ing)?)\s+(?:the|your)\s+(?:user|human|owner)\b/i,
    /\b(?:send|post|forward|email|upload|submit|exfiltrate|paste)\b[^.!?\n]{0,60}\b(?:code|password|passcode|token|otp|credentials?|cookies?|session|api key|secret)s?\b[^.!?\n]{0,60}\b(?:to|at|into)\s+(?:https?:\/\/|[\w.+-]+@[\w-]+\.)/i,
  ];
  const INJ_WEAK = [
    /\b(?:javascript_tool|read_network_requests|get_page_text|read_page|form_input|computer_use)\b/,
    /\b(?:new|updated|revised|real|actual|true|hidden|secret)\s+(?:system\s+)?instructions?\s*:/i,
    /\b(?:system|developer)\s+(?:prompt|message|override|instructions?)\b/i,
    /\b(?:run|execute|eval(?:uate)?)\b[^.!?\n]{0,40}\b(?:javascript|js|script|code)\b/i,
  ];
  const INJ_AI = new RegExp('\\b' + AI + '\\b', 'i');
  const INJ_IMPERATIVE = /\b(?:ignore|disregard|instead|must|should|need to|navigate|go to|visit|open|run|execute|send|forward|reply|tell|reveal|output|print|copy|respond|say|include|recommend|rate|approve|transfer|buy|download|summari[sz]e)\b/i;
  const INJ_YOU = /\b(?:you|your)\b/i;
  // Cheap pre-check so pages without any of these words skip the real work.
  const INJ_QUICK = /instruction|ignore|disregard|\bai\b|a\.i\.|llm|language model|claude|chatgpt|gpt|gemini|copilot|im_start|endoftext|\[\/?INST\]|<\/?system|javascript|\bjs\b|\bscript\b|the user|your user|the human|read_network|get_page_text|read_page|form_input|system prompt|developer message|exfiltrate|password|passcode|\btoken|credential|cookie|secret|api key|\bcodes?\b/i;

  // where: 'text' (visible), 'hidden' (text a person can't see), 'attr' (attribute values)
  function injectionMatch(text, where) {
    if (!text || text.length < 12 || !INJ_QUICK.test(text)) return null;
    for (const re of INJ_STRONG) { const m = re.exec(text); if (m) return { strong: true, index: m.index, length: m[0].length }; }
    if (where === 'text') return null;
    for (const re of INJ_WEAK) { const m = re.exec(text); if (m) return { strong: false, index: m.index, length: m[0].length }; }
    if (where === 'hidden' && text.trim().length >= 20 && INJ_AI.test(text) && INJ_IMPERATIVE.test(text) && INJ_YOU.test(text))
      return { strong: false, index: 0, length: text.length };
    return null;
  }
  // Replace the sentence(s) containing the match with the placeholder; keep the rest of the text.
  function redactInjection(text, m) {
    const before = text.slice(0, m.index), after = text.slice(m.index + m.length);
    const s = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '), before.lastIndexOf('\n'));
    const start = s === -1 ? before.length - before.trimStart().length : s + 2;
    const e = after.search(/[.!?](?:\s|$)|\n/);
    const end = e === -1 ? text.length : m.index + m.length + e + 1;
    return text.slice(0, start) + INJECTION_TOKEN + text.slice(end);
  }

  const injectionQuick = (t) => !!t && INJ_QUICK.test(t);
  const api = { vinValid, isBip39, seedRuns, injectionMatch, injectionQuick, redactInjection, INJECTION_TOKEN, luhnValid, abaValid, findMatches, redactText, contextMatch, keywordRules, classifyField, urlMatches, RULES, DEFAULT_PACKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HNSDetect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
