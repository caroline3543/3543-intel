// Small, sourced Exploration-only reference. No unverified skill-ID or target-order mapping.
export const ARENA_RESEARCH_DATE='2026-10-21';
export const arenaResearch={
 '50018':{name:'Alonso',source:'https://www.whiteoutsurvival.wiki/heroes/alonso/',notes:'Area damage and control. Trapnet immobilizes for 1.5s. Harpoon Blast adds periodic stuns; strike counts and stun duration depend on skill level.',skills:[
  {name:'Trapnet',kind:'damage',percent:[200,220,240,260,280],note:'Area skill; immobilizes for 1.5s.'},
  {name:'Tidal Force',kind:'damage',percent:[50,55,60,65,70],note:'Area damage from the harpoon attack.'}
 ]},
 '50024':{name:'Hector',source:'https://www.whiteoutsurvival.wiki/heroes/hector/',notes:'Sword Whirlwind grants control immunity for its 4-second window. Below 50% health, Desperado reduces damage taken and Adrenaline Surge raises Attack. These conditions must be modelled before predicting survival.',skills:[
  {name:'Sword Whirlwind',kind:'attackSpeed',percent:[80,90,100,110,120],note:'Attack Speed increase for 4s; immune to Freeze, Stun and other control effects during the skill.'},
  {name:'Desperado',kind:'damageReduction',percent:[20,30,40,50,60],note:'Damage Taken reduction while health is below 50%.'},
  {name:'Adrenaline Surge',kind:'attackBonus',percent:[16,24,32,40,48],note:'Attack increase while health is below 50%.'}
 ]},
 '50016':{name:'Mia',source:'https://www.whiteoutsurvival.wiki/heroes/mia/',notes:'Damage and healing vary randomly. The published range does not specify a probability distribution, so an average outcome is not assumed.',skills:[
  {name:'Fate’s Finale',kind:'damage',percent:[270,297,324,351,378],note:'Also either lowers target Attack by 20% for 2s or stuns for 1.5s; outcome probabilities are not specified.'},
  {name:'Bad Omen',kind:'damage',percent:[50,55,60,65,70],random:[0.05,6],note:'Result is 5%–600% of this Attack-based base value. The random distribution is unspecified.'},
  {name:'Guardian of Destiny',kind:'healing',percent:[100,110,120,130,140],random:[0.05,4],note:'Targets the hero with lowest remaining health. Healing is 5%–400% of the base value; distribution unspecified.'}
 ]},
 '50022':{name:'Lynn',source:'https://www.whiteoutsurvival.wiki/heroes/lynn/',notes:'Supports allies through debuff removal and temporary immunity. Discordant Tune reduces enemy healing; Lethal Finale also deals damage, so Lynn is not a zero-damage hero.',skills:[
  {name:'Hymn of Sidrak',kind:'attackBonus',percent:[3,4,5,6,7],note:'Removes allied debuffs and grants immunity; duration by level: 3 / 3.5 / 4 / 4.5 / 5 seconds.'},
  {name:'Lethal Finale',kind:'damage',percent:[220,240,260,280,300],note:'A penetrating attack damages enemies along its path. Exact path geometry is not modelled.'},
  {name:'Discordant Tune',kind:'healingReduction',percent:[40,45,50,55,60],note:'Reduces enemy healing effects. Also lowers Attack Speed by 1 / 1.5 / 2 / 2.5 / 3%.'}
 ]},
 '50026':{name:'Gwen',source:'https://www.whiteoutsurvival.wiki/heroes/gwen-2/',notes:'Salvo explicitly targets the rear, prioritising heroes. A frontline-only targeting model would miss this threat.',skills:[
  {name:'Salvo',kind:'damage',percent:[180,198,216,234,252],note:'Area attack against rear enemies, heroes first; lowers target Attack Speed by 50% for 2s.'},
  {name:'Sky Sniper',kind:'damage',percent:[100,110,120,130,140],random:[1,2],note:'Heroes first. Has a stated 50% chance of double damage. Output shows the two scaling branches, not a win chance.'},
  {name:'Hellfire',kind:'damagePerSecond',percent:[35,38.5,42,45.5,49],note:'Damage per second over 3s. Tick timing and mitigation are not simulated.'}
 ]},
 '50014':{name:'Reina',source:'https://www.whiteoutsurvival.wiki/heroes/reina/',notes:'Has area damage, immobilisation and a normal-attack dodge chance. Dodge wording does not establish avoidance of skill damage.',skills:[
  {name:'Phantom Assault',kind:'damage',percent:[300,330,360,390,420],note:'Area damage from an illusion attacking from behind; exact targeting geometry is not modelled.'},
  {name:'Vanishing Technique',kind:'normalDodge',percent:[5,10,15,20,25],note:'Chance to dodge a Normal Attack. Not a general skill-damage dodge rate.'},
  {name:'Poison of Demon',kind:'damage',percent:[100,110,120,130,140],note:'Prioritises heroes and immobilizes the target for 1.5s.'}
 ]}
};
