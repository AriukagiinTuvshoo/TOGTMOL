import type { DesignTheme } from "@/types/study";
import type { AmbientId } from "@/lib/music/catalog";

export type RoomTheme = {
  name: string;
  palette: {
    wall: string;
    floor: string;
    wood: string;
    sky: string;
    accent: string;
  };
  ui: {
    light: {
      bg: string;
      surface: string;
      surfaceMuted: string;
      text: string;
      muted: string;
      border: string;
      accent: string;
      accentSoft: string;
      hero: string;
      yellow: string;
      yellowSoft: string;
      radius: string;
      buttonRadius: string;
      shadow: string;
    };
    dark: {
      bg: string;
      surface: string;
      surfaceMuted: string;
      text: string;
      muted: string;
      border: string;
      accent: string;
      accentSoft: string;
      hero: string;
      yellowSoft: string;
      danger?: string;
      radius?: string;
      buttonRadius?: string;
      shadow?: string;
    };
  };
  fontFamily: string;
  bodyBackgroundImage?: string;
  bodyBackgroundSize?: string;
  decorations: {
    wallPlanks: boolean;
    windowTrees: boolean;
    sakura: boolean;
    ocean: boolean;
    space: boolean;
    rain: boolean;
    snow: boolean;
  };
  music: AmbientId[];
};

const ui = {
  cozy: {
    light: { bg:"#f7f2e9",surface:"#fffcf6",surfaceMuted:"#f0e8dc",text:"#443e36",muted:"#776d61",border:"#e4dacb",accent:"#667b60",accentSoft:"#e5eadd",hero:"#526c50",yellow:"#e8c890",yellowSoft:"#f8efd9",radius:"24px",buttonRadius:"13px",shadow:"0 8px 32px #69584208" },
    dark: { bg:"#28241f",surface:"#322d25",surfaceMuted:"#3c342c",text:"#f3e9d8",muted:"#c1b3a2",border:"#4b4136",accent:"#c0c89f",accentSoft:"#434936",hero:"#35462c",yellowSoft:"#4a402e" },
  },
  minimal: {
    light: { bg:"#f3f2ef",surface:"#fff",surfaceMuted:"#eaece8",text:"#303b39",muted:"#67716e",border:"#dce1dd",accent:"#4c6964",accentSoft:"#e6eeeb",hero:"#425d59",yellow:"#e8c890",yellowSoft:"#f8efd9",radius:"8px",buttonRadius:"6px",shadow:"none" },
    dark: { bg:"#202525",surface:"#282f2e",surfaceMuted:"#303a38",text:"#e5edeb",muted:"#a7b7b2",border:"#41524b",accent:"#a8c6ba",accentSoft:"#354c42",hero:"#425d59",yellowSoft:"#4a402e" },
  },
  forest: {
    light: { bg:"#f0f3e9",surface:"#fbfcf6",surfaceMuted:"#e6ebdb",text:"#354636",muted:"#657361",border:"#d8dfcc",accent:"#526f4f",accentSoft:"#e0e9d7",hero:"#3f603e",yellow:"#d4c680",yellowSoft:"#f2efd6",radius:"20px",buttonRadius:"20px",shadow:"0 7px 30px #344b3008" },
    dark: { bg:"#20271e",surface:"#293325",surfaceMuted:"#34402d",text:"#e7edda",muted:"#adba9e",border:"#445539",accent:"#b5cba1",accentSoft:"#3e4e34",hero:"#3f603e",yellowSoft:"#f2efd6" },
  },
  sakura: {
    light: { bg:"#f8f0ed",surface:"#fffbf8",surfaceMuted:"#f0e2de",text:"#59454a",muted:"#806f73",border:"#e8d5d2",accent:"#9a6672",accentSoft:"#f1e2e5",hero:"#845766",yellow:"#e7c79d",yellowSoft:"#f9f0e4",radius:"14px",buttonRadius:"8px",shadow:"0 6px 28px #8a5d6a08" },
    dark: { bg:"#2d252b",surface:"#382f36",surfaceMuted:"#43353f",text:"#f4e6ea",muted:"#c9abb8",border:"#594552",accent:"#e2b0c2",accentSoft:"#55404c",hero:"#845766",yellowSoft:"#f9f0e4" },
  },
  night: {
    light: { bg:"#1f2536",surface:"#292f42",surfaceMuted:"#343b51",text:"#eeedf5",muted:"#adb5cc",border:"#424b64",accent:"#c4b4e4",accentSoft:"#443e5d",hero:"#363453",yellow:"#e4cf9d",yellowSoft:"#494434",radius:"22px",buttonRadius:"12px",shadow:"0 10px 34px #0b0f241a" },
    dark: { bg:"#1f2536",surface:"#292f42",surfaceMuted:"#343b51",text:"#eeedf5",muted:"#adb5cc",border:"#424b64",accent:"#c4b4e4",accentSoft:"#443e5d",hero:"#363453",yellowSoft:"#494434" },
  },
  rainy: {
    light: { bg:"#e9eeec",surface:"#f9faf6",surfaceMuted:"#dfe7e4",text:"#304d4b",muted:"#576e6b",border:"#c7d8d3",accent:"#466f6c",accentSoft:"#dbe9e3",hero:"#375956",yellow:"#d8b783",yellowSoft:"#f2e7d3",radius:"26px",buttonRadius:"16px",shadow:"0 8px 32px #365c560a" },
    dark: { bg:"#1c2c30",surface:"#263a3e",surfaceMuted:"#30494c",text:"#e4f1ed",muted:"#acc5bf",border:"#43615f",accent:"#add5c9",accentSoft:"#34574e",hero:"#284f49",yellowSoft:"#494737" },
  },
  space: {
    light: { bg:"#181e32",surface:"#242c46",surfaceMuted:"#303c57",text:"#edf3ff",muted:"#b1c3de",border:"#405175",accent:"#a2dace",accentSoft:"#284a52",hero:"#21364c",yellow:"#e2c990",yellowSoft:"#44412f",radius:"30px",buttonRadius:"24px",shadow:"0 10px 35px #060a1822" },
    dark: { bg:"#181e32",surface:"#242c46",surfaceMuted:"#303c57",text:"#edf3ff",muted:"#b1c3de",border:"#405175",accent:"#a2dace",accentSoft:"#284a52",hero:"#21364c",yellowSoft:"#44412f" },
  },
  cabin: {
    light: { bg:"#f1e9dc",surface:"#fffbf2",surfaceMuted:"#e9ddc9",text:"#4e422f",muted:"#74634c",border:"#ddccb0",accent:"#775e3c",accentSoft:"#ecdfc6",hero:"#604b31",yellow:"#d9b079",yellowSoft:"#f6e9cb",radius:"12px",buttonRadius:"9px",shadow:"0 7px 25px #6f54300b" },
    dark: { bg:"#272820",surface:"#34352a",surfaceMuted:"#434334",text:"#efeddb",muted:"#c1bea8",border:"#565644",accent:"#c4c5a0",accentSoft:"#4a533d",hero:"#3f4935",yellowSoft:"#4c452f" },
  },
  library: {
    light: { bg:"#efeee5",surface:"#fcfbf3",surfaceMuted:"#e4e5d6",text:"#343f39",muted:"#656d5e",border:"#d4d6c4",accent:"#465e4c",accentSoft:"#e0e6d5",hero:"#344a3b",yellow:"#c4b487",yellowSoft:"#ede7d5",radius:"6px",buttonRadius:"5px",shadow:"3px 4px 0 #d4d6c433" },
    dark: { bg:"#272820",surface:"#34352a",surfaceMuted:"#434334",text:"#efeddb",muted:"#c1bea8",border:"#565644",accent:"#c4c5a0",accentSoft:"#4a533d",hero:"#3f4935",yellowSoft:"#4c452f" },
  },
  ocean: {
    light: { bg:"#eaf3f2",surface:"#fafffc",surfaceMuted:"#dceceb",text:"#284e56",muted:"#536f73",border:"#c6dedc",accent:"#36777e",accentSoft:"#d7ebea",hero:"#28616a",yellow:"#e7cb9c",yellowSoft:"#f5eddc",radius:"32px",buttonRadius:"22px",shadow:"0 8px 30px #31646b0a" },
    dark: { bg:"#1c2c30",surface:"#263a3e",surfaceMuted:"#30494c",text:"#e4f1ed",muted:"#acc5bf",border:"#43615f",accent:"#add5c9",accentSoft:"#34574e",hero:"#284f49",yellowSoft:"#494737" },
  },
} as const;

const palettes: Record<DesignTheme, RoomTheme["palette"]> = {
  rainy:{wall:"#e6e3dc",floor:"#b7aaa0",wood:"#887f78",sky:"#acbfc6",accent:"#64858c"},
  space:{wall:"#202844",floor:"#333652",wood:"#645d80",sky:"#111c38",accent:"#b6acf0"},
  cabin:{wall:"#eee2cc",floor:"#ccb697",wood:"#a78766",sky:"#d5e2e4",accent:"#8a745d"},
  library:{wall:"#e8e1d0",floor:"#ceba9a",wood:"#8f7259",sky:"#edd6b1",accent:"#7a8162"},
  ocean:{wall:"#e2efec",floor:"#c9deda",wood:"#9bb8b3",sky:"#c1e2e8",accent:"#5796a4"},
  cozy:{wall:"#f3e8d5",floor:"#e5d1b5",wood:"#c3a181",sky:"#dbe4d2",accent:"#819b7c"},
  minimal:{wall:"#eeeae4",floor:"#ddd9d2",wood:"#b1ada5",sky:"#d9e2e1",accent:"#748786"},
  night:{wall:"#252e43",floor:"#30394e",wood:"#655869",sky:"#17233e",accent:"#b5a2ce"},
  forest:{wall:"#e2e8d7",floor:"#c9d5b8",wood:"#92a183",sky:"#cbdcbf",accent:"#6f8e70"},
  sakura:{wall:"#f1e5df",floor:"#e5cebd",wood:"#c0a091",sky:"#ebdfe0",accent:"#b68590"},
};

const music: Record<DesignTheme, AmbientId[]> = {
  rainy:["rain","cafe","piano"], space:["deep","ambient","night"], cabin:["piano","nature","lofi"],
  library:["deep","piano","white"], ocean:["ambient","nature","white"], cozy:["lofi","cafe","piano"],
  forest:["nature","rain","ambient"], night:["night","rain","ambient"], sakura:["piano","nature","rain"],
  minimal:["ambient","piano","rain"],
};

export const ROOM_THEMES: Record<DesignTheme, RoomTheme> = {
  cozy:{name:"Cozy Cat",palette:palettes.cozy,ui:ui.cozy,fontFamily:'Georgia, "Times New Roman", serif',decorations:{wallPlanks:false,windowTrees:false,sakura:false,ocean:false,space:false,rain:false,snow:false},music:music.cozy},
  minimal:{name:"Minimal Focus",palette:palettes.minimal,ui:ui.minimal,fontFamily:"Arial, sans-serif",decorations:{wallPlanks:false,windowTrees:false,sakura:false,ocean:false,space:false,rain:false,snow:false},music:music.minimal},
  night:{name:"Night Study",palette:palettes.night,ui:ui.night,fontFamily:'Georgia, "Times New Roman", serif',decorations:{wallPlanks:false,windowTrees:false,sakura:false,ocean:false,space:false,rain:false,snow:false},music:music.night},
  forest:{name:"Forest Study",palette:palettes.forest,ui:ui.forest,fontFamily:'Georgia, "Times New Roman", serif',decorations:{wallPlanks:false,windowTrees:true,sakura:false,ocean:false,space:false,rain:false,snow:false},music:music.forest},
  sakura:{name:"Sakura",palette:palettes.sakura,ui:ui.sakura,fontFamily:'Georgia, "Times New Roman", serif',decorations:{wallPlanks:false,windowTrees:false,sakura:true,ocean:false,space:false,rain:false,snow:false},music:music.sakura},
  rainy:{name:"Rainy Café",palette:palettes.rainy,ui:ui.rainy,fontFamily:'Georgia, "Times New Roman", serif',bodyBackgroundImage:"repeating-linear-gradient(115deg, transparent 0 35px, #5c868405 36px 37px)",decorations:{wallPlanks:false,windowTrees:false,sakura:false,ocean:false,space:false,rain:true,snow:false},music:music.rainy},
  space:{name:"Space Study",palette:palettes.space,ui:ui.space,fontFamily:'Georgia, "Times New Roman", serif',bodyBackgroundImage:"radial-gradient(#aecbe51f 1px, transparent 1px)",bodyBackgroundSize:"43px 43px",decorations:{wallPlanks:false,windowTrees:false,sakura:false,ocean:false,space:true,rain:false,snow:false},music:music.space},
  cabin:{name:"Mountain Cabin",palette:palettes.cabin,ui:ui.cabin,fontFamily:'Georgia, "Times New Roman", serif',decorations:{wallPlanks:true,windowTrees:true,sakura:false,ocean:false,space:false,rain:false,snow:true},music:music.cabin},
  library:{name:"Quiet Library",palette:palettes.library,ui:ui.library,fontFamily:'Georgia, "Times New Roman", serif',decorations:{wallPlanks:false,windowTrees:false,sakura:false,ocean:false,space:false,rain:false,snow:false},music:music.library},
  ocean:{name:"Ocean Calm",palette:palettes.ocean,ui:ui.ocean,fontFamily:'Georgia, "Times New Roman", serif',decorations:{wallPlanks:false,windowTrees:false,sakura:false,ocean:true,space:false,rain:false,snow:false},music:music.ocean},
};
