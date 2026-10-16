/* NexoraPilot Agency — shared config + default services (public site & admin ব্যবহার করে)
   দাম/সময়/ফলাফলের কোনো দাবি এখানে নেই — সব Admin Panel থেকে পরিবর্তনযোগ্য */
window.AGENCY_DEFAULTS = {
  /* বর্তমান অ্যাপের Support widget (app.js) যে নম্বরে wa.me লিংক ব্যবহার করে সেটিই এখানে। Admin → Agency → Settings থেকে বদলানো যাবে */
  WHATSAPP: '8801859393487',
  BUSINESS_TYPES: ['Clothing & Fashion','Cosmetics & Beauty','Electronics','Food & Grocery','Home & Lifestyle','General E-commerce','Other'],
  STAGES: ['নতুন শুরু করব','নতুন অনলাইন স্টোর আছে','নিয়মিত অর্ডার পাই','বিক্রি কমে গেছে','Ads চালাচ্ছি কিন্তু ফলাফল ভালো নয়'],
  PROBLEMS: ['Facebook Ads Setup','Facebook Ads Sales কম','TikTok Ads Setup','TikTok Ads Sales কম','Pixel বা Conversion Tracking','Website বা Landing Page','Product Content ও Creative','কম বাজেটে Marketing','Customer Conversion','Sales Growth Strategy','অন্য সমস্যা'],
  BUDGETS: ['এখনো Ads চালাই না','৳৫,০০০-এর নিচে','৳৫,০০০–৳১৫,০০০','৳১৫,০০০–৳৫০,০০০','৳৫০,০০০-এর বেশি','এখনো সিদ্ধান্ত নিইনি'],
  PREFS: ['WhatsApp Message','Phone Call','Online Meeting'],
  CATS: ['Ads','Tracking & Analytics','Website & Conversion','Strategy & Content','Consulting']
};
(function(){
  var S=[
   ['Facebook Ads Account Audit','🔍','Ads','বর্তমান Facebook Ad Account-এর কাঠামো, টার্গেটিং ও খরচের সমস্যা চিহ্নিত করা।','যাদের Ads চলছে কিন্তু ফলাফল সন্তোষজনক নয়।',['Account/Campaign কাঠামো পর্যালোচনা','Audience ও Targeting পর্যালোচনা','Ad Copy ও Creative পর্যালোচনা','সমস্যার তালিকা ও অগ্রাধিকারভিত্তিক সুপারিশ']],
   ['Facebook Ads Campaign Setup','🚀','Ads','নতুন Facebook Ads Campaign গোছানোভাবে সেটআপ করা।','যারা প্রথমবার বা নতুন করে Campaign চালু করতে চান।',['Campaign/Ad Set/Ad কাঠামো','Audience ও Placement সেটআপ','Ad Copy ও Creative নির্দেশনা','Tracking যাচাই']],
   ['Facebook Ads Management','📈','Ads','চলমান Facebook Ads নিয়মিত পর্যবেক্ষণ ও অপটিমাইজেশন।','যারা নিয়মিত Ads চালান ও ব্যবস্থাপনায় সহায়তা চান।',['নির্ধারিত সময়ে Campaign পর্যালোচনা','অপটিমাইজেশন সুপারিশ/বাস্তবায়ন','পারফরম্যান্স রিপোর্ট']],
   ['TikTok Ads Setup & Management','🎵','Ads','TikTok Ads Account ও Campaign সেটআপ এবং ব্যবস্থাপনা।','যারা TikTok-এ বিজ্ঞাপন দিতে চান।',['Account ও Campaign সেটআপ','Audience ও Creative পরিকল্পনা','Tracking সেটআপ যাচাই','পারফরম্যান্স পর্যালোচনা']],
   ['Meta Pixel Setup & Troubleshooting','🧩','Tracking & Analytics','Meta Pixel ইনস্টল, ইভেন্ট যাচাই ও সমস্যা সমাধান।','যাদের Pixel নেই বা ইভেন্ট ঠিকমতো আসছে না।',['Pixel ইনস্টল/যাচাই','Standard Event সেটআপ','ভুল/ডুপ্লিকেট ইভেন্ট চিহ্নিতকরণ','সেটআপ ডকুমেন্টেশন']],
   ['TikTok Pixel Setup & Troubleshooting','🎯','Tracking & Analytics','TikTok Pixel ইনস্টল ও ইভেন্ট ট্র্যাকিং ঠিক করা।','যারা TikTok Ads-এর কনভার্শন ট্র্যাক করতে চান।',['Pixel ইনস্টল/যাচাই','Event সেটআপ','সমস্যা চিহ্নিতকরণ ও সমাধান']],
   ['Conversion API & Event Tracking Audit','🛰️','Tracking & Analytics','Conversion API ও ইভেন্ট ট্র্যাকিংয়ের সম্পূর্ণতা ও নির্ভুলতা পর্যালোচনা।','যারা ট্র্যাকিং ডেটার নির্ভরযোগ্যতা নিয়ে সন্দিহান।',['বর্তমান ট্র্যাকিং সেটআপ পর্যালোচনা','Event ম্যাচিং/ডুপ্লিকেশন যাচাই','সুপারিশ প্রতিবেদন']],
   ['GA4 & Analytics Setup','📊','Tracking & Analytics','Google Analytics 4 ও মূল ইভেন্ট ট্র্যাকিং সেটআপ।','যারা ওয়েবসাইট ট্রাফিক ও বিক্রির ডেটা বুঝতে চান।',['GA4 প্রপার্টি সেটআপ','মূল Event/Conversion সেটআপ','ডেটা যাচাই']],
   ['E-commerce Website Audit','🛒','Website & Conversion','ওয়েবসাইট/স্টোরের ব্যবহারযোগ্যতা ও বিক্রি-বাধা চিহ্নিত করা।','যাদের ভিজিটর আছে কিন্তু অর্ডার কম।',['Navigation/Product Page পর্যালোচনা','Checkout অভিজ্ঞতা পর্যালোচনা','মোবাইল অভিজ্ঞতা যাচাই','সুপারিশ তালিকা']],
   ['Landing Page Conversion Optimization','🧲','Website & Conversion','Landing Page-এর বার্তা, গঠন ও CTA উন্নয়নের সুপারিশ।','যারা Ads-এর ট্রাফিককে অর্ডারে রূপান্তর বাড়াতে চান।',['বার্তা ও Offer পর্যালোচনা','লেআউট/CTA সুপারিশ','মোবাইল উপযোগিতা যাচাই']],
   ['Product Listing & Copywriting','✍️','Strategy & Content','পণ্যের বর্ণনা ও লিস্টিং কপি তৈরি।','যারা পণ্যের বর্ণনা আকর্ষণীয় করতে চান।',['পণ্যের শিরোনাম ও বর্ণনা','সুবিধা-ভিত্তিক বুলেট পয়েন্ট','প্রয়োজনে একাধিক ভার্সন']],
   ['Ad Creative Strategy','🎨','Strategy & Content','বিজ্ঞাপনের Creative আইডিয়া ও দিকনির্দেশনা।','যাদের Creative-এর ধারণা বা ফলাফল দুর্বল।',['Creative Angle ও আইডিয়া তালিকা','Hook/Copy নির্দেশনা','টেস্টিং পরিকল্পনা']],
   ['Video Ads Strategy','🎬','Strategy & Content','ভিডিও বিজ্ঞাপনের কাঠামো, স্ক্রিপ্ট ও টেস্টিং পরিকল্পনা।','যারা Reels/TikTok/Facebook ভিডিও Ads করতে চান।',['ভিডিও কাঠামো ও স্ক্রিপ্ট নির্দেশনা','Hook আইডিয়া','টেস্টিং পরিকল্পনা']],
   ['E-commerce Marketing Strategy','🧭','Strategy & Content','ব্যবসার অবস্থা অনুযায়ী মার্কেটিং পরিকল্পনা।','যারা পরিষ্কার মার্কেটিং রোডম্যাপ চান।',['ব্যবসা ও বাজার পর্যালোচনা','চ্যানেল/বাজেট পরিকল্পনা','পর্যায়ভিত্তিক করণীয়']],
   ['Sales Funnel Planning','🔻','Strategy & Content','দর্শক থেকে ক্রেতায় রূপান্তরের ধাপভিত্তিক Funnel পরিকল্পনা।','যারা বিক্রির প্রক্রিয়া সাজাতে চান।',['Funnel ধাপ ও বার্তা পরিকল্পনা','Offer ও Follow-up নির্দেশনা','মাপার মেট্রিক নির্ধারণ']],
   ['Retargeting Strategy','🔁','Ads','পূর্ববর্তী ভিজিটর/ইনটারেক্টরদের আবার টার্গেট করার পরিকল্পনা।','যাদের ভিজিটর আছে কিন্তু অর্ডার সম্পূর্ণ হয় না।',['Retargeting Audience পরিকল্পনা','বার্তা ও Creative নির্দেশনা','বাজেট বণ্টন সুপারিশ']],
   ['Campaign Performance Reporting','🧾','Consulting','Campaign ফলাফলের সহজবোধ্য প্রতিবেদন ও পরবর্তী করণীয়।','যারা ফলাফল বুঝে সিদ্ধান্ত নিতে চান।',['নির্বাচিত সময়ের পারফরম্যান্স সারাংশ','মূল মেট্রিক বিশ্লেষণ','পরবর্তী পদক্ষেপ সুপারিশ']],
   ['One-to-One Marketing Consultation','💬','Consulting','আপনার ব্যবসার নির্দিষ্ট সমস্যা নিয়ে সরাসরি পরামর্শ সেশন।','যারা নির্দিষ্ট সমস্যায় বিশেষজ্ঞ পরামর্শ চান।',['সমস্যা বিশ্লেষণ','করণীয়ের অগ্রাধিকার তালিকা','সেশন-পরবর্তী সারাংশ']]
  ];
  window.AGENCY_DEFAULT_SERVICES = S.map(function(s,i){
    return {id:'svc'+String(i+1).padStart(2,'0'),name:s[0],icon:s[1],category:s[2],short:s[3],audience:s[4],deliverables:s[5],
      scope:['আপনার ব্যবসা ও বর্তমান অবস্থা বোঝা','উপরের Deliverables অনুযায়ী কাজ','চূড়ান্ত scope, সংখ্যা ও সময়সীমা কোটেশনে লিখিতভাবে নির্ধারিত হবে'],
      requirements:['ব্যবসা/পণ্যের প্রাথমিক তথ্য','প্রয়োজনীয় অ্যাকাউন্ট/পেজের (দেখার বা পরিচালনার) অনুমতি','যোগাযোগের জন্য WhatsApp নম্বর'],
      faqs:[{q:'এই সার্ভিসে কি নির্দিষ্ট ফলাফলের নিশ্চয়তা আছে?',a:'না। বিক্রি বা ফলাফলের নিশ্চয়তা দেওয়া হয় না। কাজ, সংখ্যা ও সময়সীমা কোটেশনে পরিষ্কার লেখা থাকবে।'},{q:'মূল্য কত?',a:'আপনার প্রয়োজন অনুযায়ী কাস্টম কোটেশন দেওয়া হবে। কোটেশন অনুরোধ বিনামূল্যে।'}],
      price:null,priceText:'Custom Quote',startingPrice:false,timeline:'',active:true,featured:i===0||i===4||i===17,order:i+1};
  });
})();
