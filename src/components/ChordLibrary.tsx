import { useState } from "react";

const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const TYPES = ["Major", "Minor", "7", "m7", "maj7"];

const CHORD_DB: Record<string, Record<string, { frets: number[]; baseFret: number }>> = {
  "C": {
    "Major": { frets: [-1, 3, 2, 0, 1, 0], baseFret: 1 },
    "Minor": { frets: [-1, 3, 5, 5, 4, 3], baseFret: 3 },
    "7": { frets: [-1, 3, 2, 3, 1, 0], baseFret: 1 },
    "m7": { frets: [-1, 3, 5, 3, 4, 3], baseFret: 3 },
    "maj7": { frets: [-1, 3, 2, 0, 0, 0], baseFret: 1 }
  },
  "C#": {
    "Major": { frets: [-1, 4, 6, 6, 6, 4], baseFret: 4 },
    "Minor": { frets: [-1, 4, 6, 6, 5, 4], baseFret: 4 },
    "7": { frets: [-1, 4, 6, 4, 6, 4], baseFret: 4 },
    "m7": { frets: [-1, 4, 6, 4, 5, 4], baseFret: 4 },
    "maj7": { frets: [-1, 4, 6, 5, 6, 4], baseFret: 4 }
  },
  "D": {
    "Major": { frets: [-1, -1, 0, 2, 3, 2], baseFret: 1 },
    "Minor": { frets: [-1, -1, 0, 2, 3, 1], baseFret: 1 },
    "7": { frets: [-1, -1, 0, 2, 1, 2], baseFret: 1 },
    "m7": { frets: [-1, -1, 0, 2, 1, 1], baseFret: 1 },
    "maj7": { frets: [-1, -1, 0, 2, 2, 2], baseFret: 1 }
  },
  "Eb": {
    "Major": { frets: [-1, 6, 8, 8, 8, 6], baseFret: 6 },
    "Minor": { frets: [-1, 6, 8, 8, 7, 6], baseFret: 6 },
    "7": { frets: [-1, 6, 8, 6, 8, 6], baseFret: 6 },
    "m7": { frets: [-1, 6, 8, 6, 7, 6], baseFret: 6 },
    "maj7": { frets: [-1, 6, 8, 7, 8, 6], baseFret: 6 }
  },
  "E": {
    "Major": { frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
    "Minor": { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
    "7": { frets: [0, 2, 0, 1, 0, 0], baseFret: 1 },
    "m7": { frets: [0, 2, 0, 0, 0, 0], baseFret: 1 },
    "maj7": { frets: [0, 2, 1, 1, 0, 0], baseFret: 1 }
  },
  "F": {
    "Major": { frets: [1, 3, 3, 2, 1, 1], baseFret: 1 },
    "Minor": { frets: [1, 3, 3, 1, 1, 1], baseFret: 1 },
    "7": { frets: [1, 3, 1, 2, 1, 1], baseFret: 1 },
    "m7": { frets: [1, 3, 1, 1, 1, 1], baseFret: 1 },
    "maj7": { frets: [1, 3, 2, 2, 1, 1], baseFret: 1 }
  },
  "F#": {
    "Major": { frets: [2, 4, 4, 3, 2, 2], baseFret: 2 },
    "Minor": { frets: [2, 4, 4, 2, 2, 2], baseFret: 2 },
    "7": { frets: [2, 4, 2, 3, 2, 2], baseFret: 2 },
    "m7": { frets: [2, 4, 2, 2, 2, 2], baseFret: 2 },
    "maj7": { frets: [2, 4, 3, 3, 2, 2], baseFret: 2 }
  },
  "G": {
    "Major": { frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
    "Minor": { frets: [3, 5, 5, 3, 3, 3], baseFret: 3 },
    "7": { frets: [3, 2, 0, 0, 0, 1], baseFret: 1 },
    "m7": { frets: [3, 5, 3, 3, 3, 3], baseFret: 3 },
    "maj7": { frets: [3, 2, 0, 0, 0, 2], baseFret: 1 }
  },
  "G#": {
    "Major": { frets: [4, 6, 6, 5, 4, 4], baseFret: 4 },
    "Minor": { frets: [4, 6, 6, 4, 4, 4], baseFret: 4 },
    "7": { frets: [4, 6, 4, 5, 4, 4], baseFret: 4 },
    "m7": { frets: [4, 6, 4, 4, 4, 4], baseFret: 4 },
    "maj7": { frets: [4, 6, 5, 5, 4, 4], baseFret: 4 }
  },
  "A": {
    "Major": { frets: [-1, 0, 2, 2, 2, 0], baseFret: 1 },
    "Minor": { frets: [-1, 0, 2, 2, 1, 0], baseFret: 1 },
    "7": { frets: [-1, 0, 2, 0, 2, 0], baseFret: 1 },
    "m7": { frets: [-1, 0, 2, 0, 1, 0], baseFret: 1 },
    "maj7": { frets: [-1, 0, 2, 1, 2, 0], baseFret: 1 }
  },
  "Bb": {
    "Major": { frets: [-1, 1, 3, 3, 3, 1], baseFret: 1 },
    "Minor": { frets: [-1, 1, 3, 3, 2, 1], baseFret: 1 },
    "7": { frets: [-1, 1, 3, 1, 3, 1], baseFret: 1 },
    "m7": { frets: [-1, 1, 3, 1, 2, 1], baseFret: 1 },
    "maj7": { frets: [-1, 1, 3, 2, 3, 1], baseFret: 1 }
  },
  "B": {
    "Major": { frets: [-1, 2, 4, 4, 4, 2], baseFret: 2 },
    "Minor": { frets: [-1, 2, 4, 4, 3, 2], baseFret: 2 },
    "7": { frets: [-1, 2, 4, 2, 4, 2], baseFret: 2 },
    "m7": { frets: [-1, 2, 4, 2, 3, 2], baseFret: 2 },
    "maj7": { frets: [-1, 2, 4, 3, 4, 2], baseFret: 2 }
  }
};

export default function ChordLibrary() {
  const [activeRoot, setActiveRoot] = useState("C");
  const [activeType, setActiveType] = useState("Major");

  const chordData = CHORD_DB[activeRoot][activeType];
  const chordName = activeType === "Major" ? activeRoot : `${activeRoot}${activeType}`;

  return (
    <div className="bg-[#1c1c1e] text-white p-6 rounded-3xl w-full max-w-2xl border border-[#2a2a2e] shadow-2xl flex flex-col md:flex-row gap-8">
      
      <div className="flex-1">
        <h2 className="text-3xl font-extrabold text-[#1db954] mb-6 tracking-tight">Chord Library</h2>
        
        <div className="mb-6">
          <p className="text-xs text-gray-400 font-bold tracking-widest mb-3 uppercase">Root Note</p>
          <div className="flex flex-wrap gap-2">
            {ROOTS.map((root) => (
              <button
                key={root}
                onClick={() => setActiveRoot(root)}
                className={`w-12 h-12 rounded-full font-bold transition-all active:scale-95 ${
                  activeRoot === root
                    ? "bg-[#1db954] text-black shadow-[0_0_15px_rgba(29,185,84,0.4)]"
                    : "bg-[#2a2a2e] text-gray-300 hover:bg-[#3a3a3c]"
                }`}
              >
                {root}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 font-bold tracking-widest mb-3 uppercase">Chord Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`px-5 py-2 rounded-full font-bold transition-all active:scale-95 ${
                  activeType === type
                    ? "bg-[#1db954] text-black shadow-[0_0_15px_rgba(29,185,84,0.4)]"
                    : "bg-[#2a2a2e] text-gray-300 hover:bg-[#3a3a3c]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center bg-[#0d0d0f] p-8 rounded-2xl border border-[#2a2a2e] min-w-[280px]">
        <div className="w-full flex flex-col items-center">
          <div className="text-center text-4xl font-black mb-8 text-white">
            {chordName}
          </div>
          
          <div className="relative">
            {chordData.baseFret > 1 && (
              <div className="absolute -left-8 top-[32px] text-gray-400 font-bold text-sm">
                {chordData.baseFret}fr
              </div>
            )}
            
            <svg width="160" height="220" className="mx-auto select-none">
              <line 
                x1="30" y1="20" x2="130" y2="20" 
                stroke={chordData.baseFret === 1 ? "#fff" : "#3a3a3c"} 
                strokeWidth={chordData.baseFret === 1 ? "6" : "2"} 
              />

              {[1, 2, 3, 4].map(fret => (
                <line
                  key={fret}
                  x1="30" y1={20 + fret * 45}
                  x2="130" y2={20 + fret * 45}
                  stroke="#3a3a3c" strokeWidth="2"
                />
              ))}

              {[0, 1, 2, 3, 4, 5].map(str => (
                <line
                  key={str}
                  x1={30 + str * 20} y1="20"
                  x2={30 + str * 20} y2="200"
                  stroke="#777" strokeWidth={1 + (5 - str) * 0.5}
                />
              ))}

              {chordData.frets.map((fret, str) => {
                const x = 30 + str * 20;
                
                if (fret === -1) {
                  return (
                    <text key={str} x={x} y="10" fill="#ff5252" fontSize="14" textAnchor="middle" fontWeight="bold">
                      X
                    </text>
                  );
                }
                
                if (fret === 0) {
                  return (
                    <circle key={str} cx={x} cy="8" r="5" fill="none" stroke="#1db954" strokeWidth="2" />
                  );
                }

                const relativeFret = fret - chordData.baseFret + 1;
                const y = 20 + (relativeFret * 45) - 22.5;

                return (
                  <circle key={str} cx={x} cy={y} r="8" fill="#1db954" />
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}