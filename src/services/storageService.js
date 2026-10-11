/**
 * STORAGE SERVICE FOR CHECKING BOARD
 * Handles persistence via LocalStorage + Supabase database sync
 */

const STORAGE_KEY_COMPANIES = 'checkingboard_companies_v2';
const STORAGE_KEY_DRIVERS = 'checkingboard_drivers_v2';

// Seed data populated with full company fleet & driver roster
export const INITIAL_COMPANIES = [
  {
    "id": "comp-1",
    "name": "INFINITY LOGISTEX LLC",
    "note": "",
    "order": 1
  },
  {
    "id": "comp-2",
    "name": "RUZBEK LOGISTICS INC",
    "note": "",
    "order": 2
  },
  {
    "id": "comp-3",
    "name": "AK CARRIER LLC",
    "note": "FACTOR",
    "order": 3
  },
  {
    "id": "comp-4",
    "name": "AK CARRIER LLC",
    "note": "LEADER",
    "order": 4
  },
  {
    "id": "comp-5",
    "name": "UMAR INC LLC",
    "note": "TT ELD",
    "order": 5
  },
  {
    "id": "comp-6",
    "name": "UZB TRUCKING LLC",
    "note": "LEADER ELD",
    "order": 6
  },
  {
    "id": "comp-7",
    "name": "UZB TRUCKING LLC",
    "note": "FACTOR ELD",
    "order": 7
  },
  {
    "id": "comp-8",
    "name": "CARGO KINGS INC",
    "note": "",
    "order": 8
  },
  {
    "id": "comp-9",
    "name": "BIG LIFE LOGISTICS",
    "note": "",
    "order": 9
  },
  {
    "id": "comp-10",
    "name": "MKM GLOBAL INC",
    "note": "",
    "order": 10
  }
];

export const INITIAL_DRIVERS = [
  {
    "id": "drv-1",
    "companyId": "comp-1",
    "unit": "",
    "name": "Pervez Adnan",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 1
  },
  {
    "id": "drv-2",
    "companyId": "comp-1",
    "unit": "",
    "name": "Shamirzaev Shohmirzo",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 2
  },
  {
    "id": "drv-3",
    "companyId": "comp-1",
    "unit": "",
    "name": "Nisbett Jakirth Anthony",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 3
  },
  {
    "id": "drv-4",
    "companyId": "comp-1",
    "unit": "",
    "name": "SHIRULLAH ZAMRAI",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 4
  },
  {
    "id": "drv-5",
    "companyId": "comp-1",
    "unit": "",
    "name": "Parmanov Rinat",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 5
  },
  {
    "id": "drv-6",
    "companyId": "comp-1",
    "unit": "",
    "name": "Ikromjon Shodiyorov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 6
  },
  {
    "id": "drv-7",
    "companyId": "comp-1",
    "unit": "",
    "name": "Waliullah Waladeen/ Ghaizullah Karwan",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 7
  },
  {
    "id": "drv-8",
    "companyId": "comp-2",
    "unit": "",
    "name": "Khurshid Abdullaev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 8
  },
  {
    "id": "drv-9",
    "companyId": "comp-2",
    "unit": "",
    "name": "Farkhod Usmonov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 9
  },
  {
    "id": "drv-10",
    "companyId": "comp-2",
    "unit": "",
    "name": "Ibrokhim Bozorov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 10
  },
  {
    "id": "drv-11",
    "companyId": "comp-2",
    "unit": "",
    "name": "Khujaev Ruzimboy",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 11
  },
  {
    "id": "drv-12",
    "companyId": "comp-3",
    "unit": "",
    "name": "Ikhtiyor Sharipov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 12
  },
  {
    "id": "drv-13",
    "companyId": "comp-3",
    "unit": "",
    "name": "Daniel Ndayisba",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 13
  },
  {
    "id": "drv-14",
    "companyId": "comp-3",
    "unit": "",
    "name": "MUNGUIKO FREDERICK GAFARANGA",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 14
  },
  {
    "id": "drv-15",
    "companyId": "comp-3",
    "unit": "",
    "name": "JOKHONGIR SAFAROV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 15
  },
  {
    "id": "drv-16",
    "companyId": "comp-3",
    "unit": "",
    "name": "Ezekiel Nkezabera",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 16
  },
  {
    "id": "drv-17",
    "companyId": "comp-3",
    "unit": "",
    "name": "Siroj Nazarkosimov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 17
  },
  {
    "id": "drv-18",
    "companyId": "comp-3",
    "unit": "",
    "name": "GAFISHI EMMANUEL",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 18
  },
  {
    "id": "drv-19",
    "companyId": "comp-3",
    "unit": "",
    "name": "MUGISHA EMILE",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 19
  },
  {
    "id": "drv-20",
    "companyId": "comp-4",
    "unit": "",
    "name": "RONALD ARCHILLE",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 20
  },
  {
    "id": "drv-21",
    "companyId": "comp-4",
    "unit": "",
    "name": "INNOCENT RUBONEZA",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 21
  },
  {
    "id": "drv-22",
    "companyId": "comp-4",
    "unit": "",
    "name": "Elie Nkikabahizi",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 22
  },
  {
    "id": "drv-23",
    "companyId": "comp-4",
    "unit": "",
    "name": "Jean Wilbens Bouquette",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 23
  },
  {
    "id": "drv-24",
    "companyId": "comp-4",
    "unit": "",
    "name": "Erkinov Asilbek/ Sindarov Olimjon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 24
  },
  {
    "id": "drv-25",
    "companyId": "comp-4",
    "unit": "",
    "name": "Joshara Jashaunae Joneria Harris",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 25
  },
  {
    "id": "drv-26",
    "companyId": "comp-4",
    "unit": "",
    "name": "Johnson Daquan Markel",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 26
  },
  {
    "id": "drv-27",
    "companyId": "comp-4",
    "unit": "",
    "name": "BROWN DE' VUNTEA DARNELL",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 27
  },
  {
    "id": "drv-28",
    "companyId": "comp-4",
    "unit": "",
    "name": "Dameus Augunste Jean Wilner",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 28
  },
  {
    "id": "drv-29",
    "companyId": "comp-4",
    "unit": "",
    "name": "Simon Jean Eddy",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 29
  },
  {
    "id": "drv-30",
    "companyId": "comp-4",
    "unit": "",
    "name": "SHEKHROZ SHAMSIEV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 30
  },
  {
    "id": "drv-31",
    "companyId": "comp-4",
    "unit": "",
    "name": "UMRZOK ALLAEROV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 31
  },
  {
    "id": "drv-32",
    "companyId": "comp-4",
    "unit": "",
    "name": "NORBOYEV ZOKHIDJON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 32
  },
  {
    "id": "drv-33",
    "companyId": "comp-4",
    "unit": "",
    "name": "CLEMENT BABONAMPOZE",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 33
  },
  {
    "id": "drv-34",
    "companyId": "comp-4",
    "unit": "",
    "name": "AYDRUS MOHAMED AHMED",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 34
  },
  {
    "id": "drv-35",
    "companyId": "comp-4",
    "unit": "",
    "name": "WIDLOR EDOUARD",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 35
  },
  {
    "id": "drv-36",
    "companyId": "comp-4",
    "unit": "",
    "name": "SALLAM HESHAM",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 36
  },
  {
    "id": "drv-37",
    "companyId": "comp-4",
    "unit": "",
    "name": "Kikinadze Kamil Y",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 37
  },
  {
    "id": "drv-38",
    "companyId": "comp-4",
    "unit": "",
    "name": "KHOLBUTOEV SHOKHRUKH",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 38
  },
  {
    "id": "drv-39",
    "companyId": "comp-4",
    "unit": "",
    "name": "MAZARD RELPH",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 39
  },
  {
    "id": "drv-40",
    "companyId": "comp-4",
    "unit": "",
    "name": "SALAH ZERROUALI",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 40
  },
  {
    "id": "drv-41",
    "companyId": "comp-4",
    "unit": "",
    "name": "YVENS BAZILE",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 41
  },
  {
    "id": "drv-42",
    "companyId": "comp-4",
    "unit": "",
    "name": "NNAEMEKA CHARLES AMUNEKE",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 42
  },
  {
    "id": "drv-43",
    "companyId": "comp-4",
    "unit": "",
    "name": "Teweldemehin Temesgen G",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 43
  },
  {
    "id": "drv-44",
    "companyId": "comp-4",
    "unit": "",
    "name": "OLIVIER MUGISHA",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 44
  },
  {
    "id": "drv-45",
    "companyId": "comp-4",
    "unit": "",
    "name": "Innocent Mfitumukiza",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 45
  },
  {
    "id": "drv-46",
    "companyId": "comp-4",
    "unit": "",
    "name": "Baby Charles",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 46
  },
  {
    "id": "drv-47",
    "companyId": "comp-4",
    "unit": "",
    "name": "Wallace Bradford Brian",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 47
  },
  {
    "id": "drv-48",
    "companyId": "comp-4",
    "unit": "",
    "name": "Milord Olguine",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 48
  },
  {
    "id": "drv-49",
    "companyId": "comp-4",
    "unit": "",
    "name": "Jamshidjon Rakhmonov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 49
  },
  {
    "id": "drv-50",
    "companyId": "comp-4",
    "unit": "",
    "name": "Sanders Quadir-almalik Monroe",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 50
  },
  {
    "id": "drv-51",
    "companyId": "comp-4",
    "unit": "",
    "name": "Hakizimana Promise",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 51
  },
  {
    "id": "drv-52",
    "companyId": "comp-4",
    "unit": "",
    "name": "Jonathan Edwards",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 52
  },
  {
    "id": "drv-53",
    "companyId": "comp-4",
    "unit": "",
    "name": "Tuyisenge Patrick Bajoje",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 53
  },
  {
    "id": "drv-54",
    "companyId": "comp-4",
    "unit": "",
    "name": "Rukaza Jean Bosco",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 54
  },
  {
    "id": "drv-55",
    "companyId": "comp-4",
    "unit": "",
    "name": "Sejour Jasnel",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 55
  },
  {
    "id": "drv-56",
    "companyId": "comp-4",
    "unit": "",
    "name": "Manzi Ibrahim Dalas",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 56
  },
  {
    "id": "drv-57",
    "companyId": "comp-4",
    "unit": "",
    "name": "Bizimungu Kalihungu/Kabose Dasan",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 57
  },
  {
    "id": "drv-58",
    "companyId": "comp-4",
    "unit": "",
    "name": "Joshua  Lee Wells",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 58
  },
  {
    "id": "drv-59",
    "companyId": "comp-4",
    "unit": "",
    "name": "Islombek Tirkashev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 59
  },
  {
    "id": "drv-60",
    "companyId": "comp-4",
    "unit": "",
    "name": "Esengo Kanyoni",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 60
  },
  {
    "id": "drv-61",
    "companyId": "comp-4",
    "unit": "",
    "name": "Jackson Letarvis William Demel",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 61
  },
  {
    "id": "drv-62",
    "companyId": "comp-4",
    "unit": "",
    "name": "Prince Ngoga",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 62
  },
  {
    "id": "drv-63",
    "companyId": "comp-4",
    "unit": "",
    "name": "Jeremy Zapata",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 63
  },
  {
    "id": "drv-64",
    "companyId": "comp-4",
    "unit": "",
    "name": "SANJAR GAYBULLAEV/ Islombek Tirkashev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 64
  },
  {
    "id": "drv-65",
    "companyId": "comp-4",
    "unit": "",
    "name": "BALDE THIERNO DAOUDA",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 65
  },
  {
    "id": "drv-66",
    "companyId": "comp-4",
    "unit": "",
    "name": "Gallardo Salomon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 66
  },
  {
    "id": "drv-67",
    "companyId": "comp-5",
    "unit": "",
    "name": "Rostyslav Vorontsov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "boxtruck",
    "highlightColor": "",
    "orderIndex": 67
  },
  {
    "id": "drv-68",
    "companyId": "comp-5",
    "unit": "",
    "name": "ALLAEV BAKHTIYOR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "SHIFT inform tashlela !",
    "highlightColor": "",
    "orderIndex": 68
  },
  {
    "id": "drv-69",
    "companyId": "comp-5",
    "unit": "",
    "name": "Ilyosbek Sobirov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 69
  },
  {
    "id": "drv-70",
    "companyId": "comp-5",
    "unit": "",
    "name": "Farhad Fattahli",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 70
  },
  {
    "id": "drv-71",
    "companyId": "comp-5",
    "unit": "",
    "name": "Yorkin Erkinovich Ishanov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 71
  },
  {
    "id": "drv-72",
    "companyId": "comp-5",
    "unit": "",
    "name": "Omonov Musurmonkul",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 72
  },
  {
    "id": "drv-73",
    "companyId": "comp-5",
    "unit": "",
    "name": "SALOMOV BOBIR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 73
  },
  {
    "id": "drv-74",
    "companyId": "comp-5",
    "unit": "",
    "name": "Abdujabbor Abdurakhmanov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 74
  },
  {
    "id": "drv-75",
    "companyId": "comp-5",
    "unit": "",
    "name": "MAMATKULOV ISKANDAR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 75
  },
  {
    "id": "drv-76",
    "companyId": "comp-5",
    "unit": "",
    "name": "MIRZAMURODOV SALIM",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 76
  },
  {
    "id": "drv-77",
    "companyId": "comp-5",
    "unit": "",
    "name": "Shuhrat Eshonqulov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 77
  },
  {
    "id": "drv-78",
    "companyId": "comp-5",
    "unit": "",
    "name": "RAKHMONOV DILMUROD",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 78
  },
  {
    "id": "drv-79",
    "companyId": "comp-5",
    "unit": "",
    "name": "AKHMEDOV SHAVKAT",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 79
  },
  {
    "id": "drv-80",
    "companyId": "comp-5",
    "unit": "",
    "name": "ULMASOV ORZU",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 80
  },
  {
    "id": "drv-81",
    "companyId": "comp-5",
    "unit": "",
    "name": "JAMOLIDDINOV ABDURAZZOK",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 81
  },
  {
    "id": "drv-82",
    "companyId": "comp-5",
    "unit": "",
    "name": "Najieb Rahimi",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 82
  },
  {
    "id": "drv-83",
    "companyId": "comp-5",
    "unit": "",
    "name": "ALEXANDRE WILTON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 83
  },
  {
    "id": "drv-84",
    "companyId": "comp-5",
    "unit": "",
    "name": "Zaynutdinov Uktamjon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 84
  },
  {
    "id": "drv-85",
    "companyId": "comp-5",
    "unit": "",
    "name": "Hakimov Anvarjon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 85
  },
  {
    "id": "drv-86",
    "companyId": "comp-5",
    "unit": "",
    "name": "Dilmurodkhuja",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 86
  },
  {
    "id": "drv-87",
    "companyId": "comp-5",
    "unit": "",
    "name": "Sadullaev Sadi",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 87
  },
  {
    "id": "drv-88",
    "companyId": "comp-5",
    "unit": "",
    "name": "Khumoyun Valijonov / Mansur Ikramov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 88
  },
  {
    "id": "drv-89",
    "companyId": "comp-5",
    "unit": "",
    "name": "TOKHIRJONOV ANVAR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "terpila",
    "highlightColor": "",
    "orderIndex": 89
  },
  {
    "id": "drv-90",
    "companyId": "comp-5",
    "unit": "",
    "name": "DJAYNAROV DOSTON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 90
  },
  {
    "id": "drv-91",
    "companyId": "comp-5",
    "unit": "",
    "name": "ZUNNUNOV ASQAR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 91
  },
  {
    "id": "drv-92",
    "companyId": "comp-5",
    "unit": "",
    "name": "MOSSADEK YOUNES MARCO",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 92
  },
  {
    "id": "drv-93",
    "companyId": "comp-5",
    "unit": "",
    "name": "ILKHOM TUYCHIEV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 93
  },
  {
    "id": "drv-94",
    "companyId": "comp-5",
    "unit": "",
    "name": "BADALBAEV DILMUROD",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 94
  },
  {
    "id": "drv-95",
    "companyId": "comp-5",
    "unit": "",
    "name": "KHUSEYNOV FIRDAVS",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 95
  },
  {
    "id": "drv-96",
    "companyId": "comp-5",
    "unit": "",
    "name": "KHASANOV MUSINJON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 96
  },
  {
    "id": "drv-97",
    "companyId": "comp-5",
    "unit": "",
    "name": "HERVE ALINDOR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 97
  },
  {
    "id": "drv-98",
    "companyId": "comp-5",
    "unit": "",
    "name": "NKUNZI KUMWIANI",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "UMAR EX",
    "highlightColor": "",
    "orderIndex": 98
  },
  {
    "id": "drv-99",
    "companyId": "comp-5",
    "unit": "",
    "name": "ESANOV ULUGBEK",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 99
  },
  {
    "id": "drv-100",
    "companyId": "comp-5",
    "unit": "",
    "name": "Jewel Simmons",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 100
  },
  {
    "id": "drv-101",
    "companyId": "comp-5",
    "unit": "",
    "name": "ABLAEV NODIR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 101
  },
  {
    "id": "drv-102",
    "companyId": "comp-5",
    "unit": "",
    "name": "BANKS ANTAWAN DAVID",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 102
  },
  {
    "id": "drv-103",
    "companyId": "comp-5",
    "unit": "",
    "name": "HAKIMOV ELDOR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "SHIFT inform tashlela !",
    "highlightColor": "",
    "orderIndex": 103
  },
  {
    "id": "drv-104",
    "companyId": "comp-5",
    "unit": "",
    "name": "PARDIEV ABDUKHALIL",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 104
  },
  {
    "id": "drv-105",
    "companyId": "comp-5",
    "unit": "",
    "name": "KHALKHODJAEV RUSTAM",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 105
  },
  {
    "id": "drv-106",
    "companyId": "comp-5",
    "unit": "",
    "name": "Alisher Abduraimov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 106
  },
  {
    "id": "drv-107",
    "companyId": "comp-5",
    "unit": "",
    "name": "BADALBAEV DILMUROD",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 107
  },
  {
    "id": "drv-108",
    "companyId": "comp-5",
    "unit": "",
    "name": "EDWARD GAINES",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 108
  },
  {
    "id": "drv-109",
    "companyId": "comp-5",
    "unit": "",
    "name": "Alex Awoke",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 109
  },
  {
    "id": "drv-110",
    "companyId": "comp-6",
    "unit": "",
    "name": "Sirojiddin Valiyev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 110
  },
  {
    "id": "drv-111",
    "companyId": "comp-6",
    "unit": "",
    "name": "Johnson Jeremiah Leon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 111
  },
  {
    "id": "drv-112",
    "companyId": "comp-6",
    "unit": "",
    "name": "Brahim Berrehail",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 112
  },
  {
    "id": "drv-113",
    "companyId": "comp-6",
    "unit": "",
    "name": "Kodirov Khumoyunbek",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 113
  },
  {
    "id": "drv-114",
    "companyId": "comp-6",
    "unit": "",
    "name": "Abduvokhid Ganiev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 114
  },
  {
    "id": "drv-115",
    "companyId": "comp-6",
    "unit": "",
    "name": "Jahlil Levon Blount Wiley Elwood Welch",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 115
  },
  {
    "id": "drv-116",
    "companyId": "comp-6",
    "unit": "",
    "name": "GAFFAROV BOBIRBEK",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 116
  },
  {
    "id": "drv-117",
    "companyId": "comp-6",
    "unit": "",
    "name": "Fahriddin Bazarbayev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 117
  },
  {
    "id": "drv-118",
    "companyId": "comp-6",
    "unit": "",
    "name": "AHMAD SHATORION BURTON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 118
  },
  {
    "id": "drv-119",
    "companyId": "comp-6",
    "unit": "",
    "name": "Shokhrukh Niyazov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 119
  },
  {
    "id": "drv-120",
    "companyId": "comp-6",
    "unit": "",
    "name": "Pulatov Khojakbarkhon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 120
  },
  {
    "id": "drv-121",
    "companyId": "comp-6",
    "unit": "",
    "name": "Abdulrahman Abdullah Alsalimi",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 121
  },
  {
    "id": "drv-122",
    "companyId": "comp-6",
    "unit": "",
    "name": "Barron Destin Rex",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 122
  },
  {
    "id": "drv-123",
    "companyId": "comp-6",
    "unit": "",
    "name": "Hirwa Claude",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 123
  },
  {
    "id": "drv-124",
    "companyId": "comp-6",
    "unit": "",
    "name": "Zirak Nasib Khan",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 124
  },
  {
    "id": "drv-125",
    "companyId": "comp-6",
    "unit": "",
    "name": "Said Iqbal Sadat / Zangi Khan",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 125
  },
  {
    "id": "drv-126",
    "companyId": "comp-6",
    "unit": "",
    "name": "Begijon Khakkulov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 126
  },
  {
    "id": "drv-127",
    "companyId": "comp-6",
    "unit": "",
    "name": "Turakhonov Bahodir Asrorjon Oripov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 127
  },
  {
    "id": "drv-128",
    "companyId": "comp-6",
    "unit": "",
    "name": "Irgashev Ulugbek",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 128
  },
  {
    "id": "drv-129",
    "companyId": "comp-6",
    "unit": "",
    "name": "Azizov Zokirjon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 129
  },
  {
    "id": "drv-130",
    "companyId": "comp-6",
    "unit": "",
    "name": "MAKHMUDOV JAVOKHIR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 130
  },
  {
    "id": "drv-131",
    "companyId": "comp-6",
    "unit": "",
    "name": "ZOKHIDOV MUKHAMMADALI",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 131
  },
  {
    "id": "drv-132",
    "companyId": "comp-6",
    "unit": "",
    "name": "TOSHBOEV MIRSAID",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 132
  },
  {
    "id": "drv-133",
    "companyId": "comp-6",
    "unit": "",
    "name": "MIRMUKHSIN KHUDOYBERDIEV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 133
  },
  {
    "id": "drv-134",
    "companyId": "comp-6",
    "unit": "",
    "name": "NEGMATOV GAYBILLO,UGLI",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 134
  },
  {
    "id": "drv-135",
    "companyId": "comp-6",
    "unit": "",
    "name": "IBRAGIMOV JAKHONGIR JAFAROVICH",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 135
  },
  {
    "id": "drv-136",
    "companyId": "comp-6",
    "unit": "",
    "name": "KHAYITOV JAMSHID",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 136
  },
  {
    "id": "drv-137",
    "companyId": "comp-6",
    "unit": "",
    "name": "CASTON JONATHAN LAMAR,JR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 137
  },
  {
    "id": "drv-138",
    "companyId": "comp-6",
    "unit": "",
    "name": "KODIROV ABUBAKR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 138
  },
  {
    "id": "drv-139",
    "companyId": "comp-6",
    "unit": "",
    "name": "KUVONDIKOV AKTAM",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 139
  },
  {
    "id": "drv-140",
    "companyId": "comp-6",
    "unit": "",
    "name": "BARATOV MARUF",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 140
  },
  {
    "id": "drv-141",
    "companyId": "comp-6",
    "unit": "",
    "name": "TAREK",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 141
  },
  {
    "id": "drv-142",
    "companyId": "comp-6",
    "unit": "",
    "name": "PIRMIKULOV SHERZOD",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 142
  },
  {
    "id": "drv-143",
    "companyId": "comp-7",
    "unit": "",
    "name": "Akrom Aliev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 143
  },
  {
    "id": "drv-144",
    "companyId": "comp-7",
    "unit": "",
    "name": "Yusupov Dilshodjon",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 144
  },
  {
    "id": "drv-145",
    "companyId": "comp-7",
    "unit": "",
    "name": "Jabborov Rashid",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 145
  },
  {
    "id": "drv-146",
    "companyId": "comp-7",
    "unit": "",
    "name": "Tuyiramye Reponse",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 146
  },
  {
    "id": "drv-147",
    "companyId": "comp-7",
    "unit": "",
    "name": "IRGASHEV ILKHOM",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 147
  },
  {
    "id": "drv-148",
    "companyId": "comp-7",
    "unit": "",
    "name": "ASLONOV SHAMSHODJON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 148
  },
  {
    "id": "drv-149",
    "companyId": "comp-7",
    "unit": "",
    "name": "ORIPOV ANVAR",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 149
  },
  {
    "id": "drv-150",
    "companyId": "comp-7",
    "unit": "",
    "name": "RAKHMATDJANOV BEKZOD",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 150
  },
  {
    "id": "drv-151",
    "companyId": "comp-7",
    "unit": "",
    "name": "KADIROV NODIRJON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 151
  },
  {
    "id": "drv-152",
    "companyId": "comp-7",
    "unit": "",
    "name": "SHAKHZODBEK SAIDOV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 152
  },
  {
    "id": "drv-153",
    "companyId": "comp-7",
    "unit": "",
    "name": "SHAKHZODBEK SAIDOV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 153
  },
  {
    "id": "drv-154",
    "companyId": "comp-7",
    "unit": "",
    "name": "ABDURAHMONOV AHMAD",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 154
  },
  {
    "id": "drv-155",
    "companyId": "comp-7",
    "unit": "",
    "name": "TEMUR/RUSLAN",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 155
  },
  {
    "id": "drv-156",
    "companyId": "comp-7",
    "unit": "",
    "name": "XOLBOYEV FIRDAVS",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 156
  },
  {
    "id": "drv-157",
    "companyId": "comp-7",
    "unit": "",
    "name": "YODGORBEK/AKRAM",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 157
  },
  {
    "id": "drv-158",
    "companyId": "comp-8",
    "unit": "",
    "name": "Suhrob Radjabov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 158
  },
  {
    "id": "drv-159",
    "companyId": "comp-8",
    "unit": "",
    "name": "CAMPOS SERGIO",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "terpila",
    "highlightColor": "",
    "orderIndex": 159
  },
  {
    "id": "drv-160",
    "companyId": "comp-8",
    "unit": "",
    "name": "Ali Zakariya Ahmed",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 160
  },
  {
    "id": "drv-161",
    "companyId": "comp-8",
    "unit": "",
    "name": "Jumabek Nazarov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 161
  },
  {
    "id": "drv-162",
    "companyId": "comp-8",
    "unit": "",
    "name": "Dahal Om Krishna",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 162
  },
  {
    "id": "drv-163",
    "companyId": "comp-8",
    "unit": "",
    "name": "Khalilov Azamat Abdukarimovich",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 163
  },
  {
    "id": "drv-164",
    "companyId": "comp-8",
    "unit": "",
    "name": "Sattarov Bakhrom",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 164
  },
  {
    "id": "drv-165",
    "companyId": "comp-8",
    "unit": "",
    "name": "Yuma Kabala",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 165
  },
  {
    "id": "drv-166",
    "companyId": "comp-8",
    "unit": "",
    "name": "Tursunov Ikrom",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 166
  },
  {
    "id": "drv-167",
    "companyId": "comp-8",
    "unit": "",
    "name": "Dilshod Zayniev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 167
  },
  {
    "id": "drv-168",
    "companyId": "comp-8",
    "unit": "",
    "name": "Firdavs Allanazarov",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 168
  },
  {
    "id": "drv-169",
    "companyId": "comp-8",
    "unit": "",
    "name": "RAKHMANOV SHOKHRUKH",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 169
  },
  {
    "id": "drv-170",
    "companyId": "comp-9",
    "unit": "",
    "name": "WILLIAM BREWINGTON",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 170
  },
  {
    "id": "drv-171",
    "companyId": "comp-9",
    "unit": "",
    "name": "ANTHONY / CHRISTOPHER",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 171
  },
  {
    "id": "drv-172",
    "companyId": "comp-9",
    "unit": "898",
    "name": "JEAN JOACHIM",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 172
  },
  {
    "id": "drv-173",
    "companyId": "comp-9",
    "unit": "",
    "name": "KERRY / LuCETTE",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 173
  },
  {
    "id": "drv-174",
    "companyId": "comp-9",
    "unit": "142",
    "name": "ROBINSON MALIK / MARCUS",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 174
  },
  {
    "id": "drv-175",
    "companyId": "comp-9",
    "unit": "",
    "name": "Michelet Jeanlys",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 175
  },
  {
    "id": "drv-176",
    "companyId": "comp-9",
    "unit": "27092",
    "name": "JACQUES BRYAN /  Jasmine Breona Hopson",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 176
  },
  {
    "id": "drv-177",
    "companyId": "comp-9",
    "unit": "143",
    "name": "Lazizjon Niyazov/Kodirjon Djuraev",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 177
  },
  {
    "id": "drv-178",
    "companyId": "comp-9",
    "unit": "27127",
    "name": "Jerry Raymond",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 178
  },
  {
    "id": "drv-179",
    "companyId": "comp-9",
    "unit": "27162",
    "name": "Gaynell C Carter/John Willis Morris",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 179
  },
  {
    "id": "drv-180",
    "companyId": "comp-9",
    "unit": "308",
    "name": "Jonathan Koonce/ Bernard Anthony Brooks",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 180
  },
  {
    "id": "drv-181",
    "companyId": "comp-9",
    "unit": "894",
    "name": "Jolissaint Pierre/Weston Dieujuste",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 181
  },
  {
    "id": "drv-182",
    "companyId": "comp-9",
    "unit": "27093",
    "name": "PETTIS DONYELL / NICHOLAS",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 182
  },
  {
    "id": "drv-183",
    "companyId": "comp-9",
    "unit": "",
    "name": "DALLAS UZZIAH",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 183
  },
  {
    "id": "drv-184",
    "companyId": "comp-9",
    "unit": "",
    "name": "Gedion Melese",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 184
  },
  {
    "id": "drv-185",
    "companyId": "comp-9",
    "unit": "",
    "name": "FRITZNEL JEAN LOUIS",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 185
  },
  {
    "id": "drv-186",
    "companyId": "comp-9",
    "unit": "",
    "name": "JEAN GUITHO",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 186
  },
  {
    "id": "drv-187",
    "companyId": "comp-9",
    "unit": "",
    "name": "GEORGES WIKSON / PATRICK",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 187
  },
  {
    "id": "drv-188",
    "companyId": "comp-9",
    "unit": "",
    "name": "IGOR LUTSIV",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 188
  },
  {
    "id": "drv-189",
    "companyId": "comp-9",
    "unit": "",
    "name": "STANLEY DORZIER",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 189
  },
  {
    "id": "drv-190",
    "companyId": "comp-9",
    "unit": "",
    "name": "Jean Leferne Ilerzin",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 190
  },
  {
    "id": "drv-191",
    "companyId": "comp-9",
    "unit": "",
    "name": "JEAN ODENY DEMOSTHENE",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 191
  },
  {
    "id": "drv-192",
    "companyId": "comp-9",
    "unit": "",
    "name": "Andrew George Turnbough Iii",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 192
  },
  {
    "id": "drv-193",
    "companyId": "comp-9",
    "unit": "",
    "name": "FISTIN MEDE / NICK",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 193
  },
  {
    "id": "drv-194",
    "companyId": "comp-10",
    "unit": "",
    "name": "Khusenov Khafiz",
    "sign": "SIGNED",
    "status": "READY",
    "notes": "",
    "highlightColor": "",
    "orderIndex": 194
  }
];

export function loadCompanies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPANIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load companies from localStorage:', e);
  }
  saveCompanies(INITIAL_COMPANIES);
  return INITIAL_COMPANIES;
}

export function saveCompanies(companies) {
  try {
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
  } catch (e) {
    console.error('Failed to save companies:', e);
  }
}

export function loadDrivers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRIVERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load drivers from localStorage:', e);
  }
  saveDrivers(INITIAL_DRIVERS);
  return INITIAL_DRIVERS;
}

export function saveDrivers(drivers) {
  try {
    localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(drivers));
  } catch (e) {
    console.error('Failed to save drivers:', e);
  }
}

export function resetToDefaults() {
  saveCompanies(INITIAL_COMPANIES);
  saveDrivers(INITIAL_DRIVERS);
  return {
    companies: [...INITIAL_COMPANIES],
    drivers: [...INITIAL_DRIVERS]
  };
}
