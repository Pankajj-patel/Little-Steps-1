import crypto from 'crypto';
import type Database from 'better-sqlite3';
import {
  CANONICAL_AGE_GROUPS,
  CANONICAL_LEARNING_DOMAINS,
  EDITORIAL_IMAGES,
  RETENTION_DAYS,
} from '../../src/shared/domain.ts';
import { hashPassword, verifyPassword } from '../security/crypto.ts';

function readConfiguredPassword(envName: string): string | null {
  const val = process.env[envName]?.trim();
  if (!val || val.length < 8 || val.startsWith('replace-with-')) {
    return null;
  }
  return val;
}

interface SeedActivityDef {
  ageSlug: string;
  domainSlug: string;
  title: string;
  summary: string;
  durationMinutes: number;
  materials: string[];
  safetyNotes: string;
  posterUrl: string;
  steps: Array<{ title: string; instructionText: string; caregiverTip: string }>;
  rubric: Array<{ label: string; description: string; weightPoints: number }>;
}

const STARTER_ACTIVITIES: SeedActivityDef[] = [
  // 0-3 months
  {
    ageSlug: '0-3m',
    domainSlug: 'social-emotional',
    title: 'Unhurried Face-to-Face Greeting',
    summary: 'Build calm eye contact and responsive warmth during alert morning minutes.',
    durationMinutes: 4,
    materials: ['Folded cotton dhurrie or clean bedsheet', 'Quiet sunlit room'],
    safetyNotes: 'Place baby on their back on a firm flat surface. Pause immediately if baby turns away or shows tiredness.',
    posterUrl: EDITORIAL_IMAGES.heroMontessori,
    steps: [
      {
        title: 'Prepare a calm floor spot',
        instructionText: 'Lay baby on their back in soft natural light, away from bright overhead bulbs or loud TV noise.',
        caregiverTip: 'Sit comfortably so your shoulders stay relaxed.',
      },
      {
        title: 'Hold comfortable newborn distance',
        instructionText: 'Bring your face about 20–25 cm from baby’s eyes so your features stay gently in focus.',
        caregiverTip: 'Keep movements slow and predictable.',
      },
      {
        title: 'Greet softly and wait',
        instructionText: 'Say baby’s name in a warm, unhurried voice, smile gently, and pause for 5 seconds to notice any gaze or tiny movement.',
        caregiverTip: 'Silence is part of the conversation.',
      },
      {
        title: 'Follow baby’s lead',
        instructionText: 'Respond warmly when baby looks back; if baby looks away, let them rest quietly before ending.',
        caregiverTip: 'Two peaceful minutes is plenty for newborns.',
      },
    ],
    rubric: [
      { label: 'Calm, distraction-free setup', description: 'Caregiver positioned baby safely on a flat surface in soft lighting without competing screens.', weightPoints: 25 },
      { label: 'Appropriate face distance', description: 'Caregiver stayed within ~20–30 cm at baby’s eye level for comfortable focus.', weightPoints: 25 },
      { label: 'Slow, warm voice & pauses', description: 'Caregiver spoke gently and paused to leave space for baby’s cues.', weightPoints: 25 },
      { label: 'Responsive pacing', description: 'Caregiver respected baby’s gaze breaks without forcing attention.', weightPoints: 25 },
    ],
  },
  {
    ageSlug: '0-3m',
    domainSlug: 'sensory',
    title: 'High-Contrast Cloth Tracking',
    summary: 'Invite slow visual tracking using a simple black-and-white cotton card.',
    durationMinutes: 4,
    materials: ['High-contrast linen card or bold striped cloth', 'Soft floor mat'],
    safetyNotes: 'Keep cloth out of baby’s mouth and maintain hands-on supervision throughout.',
    posterUrl: EDITORIAL_IMAGES.tummyMirror,
    steps: [
      { title: 'Settle comfortably', instructionText: 'Place baby on their back during a calm, alert window after feeding and burping.', caregiverTip: 'Avoid starting when baby is hungry.' },
      { title: 'Present the card steadily', instructionText: 'Hold the high-contrast cloth 20–25 cm above baby’s chest line until their eyes settle on it.', caregiverTip: 'Wait patiently rather than shaking it.' },
      { title: 'Move in a slow arc', instructionText: 'Glide the card slowly from center to right, pause, then return smoothly to center and left.', caregiverTip: 'Count to four as you move across.' },
      { title: 'Close softly', instructionText: 'Lower the cloth out of view and gently place your warm hand on baby’s tummy.', caregiverTip: 'Finish while baby is still relaxed.' },
    ],
    rubric: [
      { label: 'Safe positioning', description: 'Baby rested safely on a firm surface during an alert window.', weightPoints: 25 },
      { label: 'Steady initial presentation', description: 'Caregiver held the visual object still until baby noticed it.', weightPoints: 25 },
      { label: 'Slow horizontal arc', description: 'Caregiver moved smoothly without rapid shaking or jerking.', weightPoints: 30 },
      { label: 'Gentle transition out', description: 'Caregiver ended calmly before signs of overstimulation.', weightPoints: 20 },
    ],
  },

  // 3-6 months
  {
    ageSlug: '3-6m',
    domainSlug: 'physical',
    title: 'Supported Mirror Tummy Time',
    summary: 'Encourage comfortable floor exploration with a low baby-safe mirror and rolled towel.',
    durationMinutes: 5,
    materials: ['Firm cotton mat or dhurrie', 'Safe shatterproof low mirror', 'Small rolled cotton towel'],
    safetyNotes: 'Never use glass mirrors that can tip. Stay within arm’s reach and roll baby gently onto their back if tired.',
    posterUrl: EDITORIAL_IMAGES.tummyMirror,
    steps: [
      { title: 'Anchor the mirror safely', instructionText: 'Position the baby-safe mirror flat and secure at floor level beside the cotton mat.', caregiverTip: 'Check that the frame cannot wobble.' },
      { title: 'Roll gently onto tummy', instructionText: 'Guide baby slowly from back to side to tummy, tucking elbows neatly under shoulders.', caregiverTip: 'Offer a small rolled towel under the chest if needed.' },
      { title: 'Lie down at eye level', instructionText: 'Rest on the mat beside the mirror so baby sees both you and their reflection.', caregiverTip: 'Your calm voice gives reassurance.' },
      { title: 'Roll out with ease', instructionText: 'After 2–3 minutes or at early fussing, narrate “rolling back now” and turn baby gently.', caregiverTip: 'Short positive sessions build comfort.' },
    ],
    rubric: [
      { label: 'Safe surface & mirror stability', description: 'Caregiver used a firm floor mat and stable low mirror.', weightPoints: 25 },
      { label: 'Gentle shoulder-tucked transition', description: 'Caregiver rolled baby smoothly and supported comfortable arm placement.', weightPoints: 25 },
      { label: 'Caregiver at eye level', description: 'Caregiver stayed down on the floor narrating calmly beside baby.', weightPoints: 25 },
      { label: 'Respectful session length', description: 'Caregiver ended smoothly before distress escalated.', weightPoints: 25 },
    ],
  },
  {
    ageSlug: '3-6m',
    domainSlug: 'language',
    title: 'Echo & Pause Cooing Turn-Taking',
    summary: 'Practice warm back-and-forth vocal rhythm during relaxed floor time.',
    durationMinutes: 5,
    materials: ['Quiet mat space'],
    safetyNotes: 'Keep background audio off so your natural speaking voice is easy to hear.',
    posterUrl: EDITORIAL_IMAGES.heroMontessori,
    steps: [
      { title: 'Sit face-to-face', instructionText: 'Sit comfortably facing baby on the mat so baby clearly sees your mouth and expressions.', caregiverTip: 'Natural daylight helps baby read facial expressions.' },
      { title: 'Listen first', instructionText: 'Wait quietly for a sigh, coo, or vowel sound from baby.', caregiverTip: 'Resist filling every silent moment.' },
      { title: 'Mirror warmly', instructionText: 'Repeat baby’s exact sound softly, then add one simple warm phrase like “Yes, you’re talking to Mama.”', caregiverTip: 'Keep your tone natural and gentle.' },
      { title: 'Pause for a reply', instructionText: 'Hold a smiling 5-second pause to invite another turn.', caregiverTip: 'Even 4–5 exchanges are wonderful.' },
    ],
    rubric: [
      { label: 'Clear face-to-face positioning', description: 'Caregiver sat directly in baby’s line of sight.', weightPoints: 25 },
      { label: 'Quiet listening space', description: 'Caregiver minimized background noise and waited before speaking.', weightPoints: 25 },
      { label: 'Warm mirroring & naming', description: 'Caregiver echoed baby’s sounds with natural, affectionate speech.', weightPoints: 25 },
      { label: 'Consistent 5-second pauses', description: 'Caregiver left deliberate pauses for conversational turn-taking.', weightPoints: 25 },
    ],
  },

  // 6-9 months (Aarav's active band — rich 3-day sequence!)
  {
    ageSlug: '6-9m',
    domainSlug: 'sensory',
    title: 'Household Texture Basket',
    summary: 'Introduce safe everyday Indian home textures—wood, steel, and soft muslin—one item at a time.',
    durationMinutes: 6,
    materials: ['Woven cotton mat', 'Smooth neem wooden spoon', 'Small rounded steel katori', 'Folded unbleached muslin cloth'],
    safetyNotes: 'Inspect every object for sharp rims or splinters. Objects must be larger than 4 cm in diameter to prevent choking.',
    posterUrl: EDITORIAL_IMAGES.sensoryLinen,
    steps: [
      { title: 'Offer just three objects', instructionText: 'Place the wooden spoon, small rounded steel katori, and folded muslin cloth neatly on the mat—avoid clutter.', caregiverTip: 'Fewer objects invite deeper calm focus.' },
      { title: 'Sit beside, not over', instructionText: 'Sit calmly on the mat next to baby so they can reach freely with both hands.', caregiverTip: 'Keep your hands resting quietly in your lap.' },
      { title: 'Name textures gently', instructionText: 'When baby touches an item, name it simply: “Cool steel bowl” or “Soft cotton cloth.”', caregiverTip: 'Narrate only what baby chooses—avoid redirecting.' },
      { title: 'Allow unhurried mouthing & tapping', instructionText: 'Let baby explore safely with hands and mouth while you stay observant and calm.', caregiverTip: 'End when baby’s interest naturally drifts.' },
    ],
    rubric: [
      { label: 'Clean, uncluttered 3-object setup', description: 'Caregiver laid out 2–3 safe household objects neatly on a mat without visual overload.', weightPoints: 25 },
      { label: 'Hands-off patient observation', description: 'Caregiver allowed baby to choose and grasp independently without pushing objects into hands.', weightPoints: 30 },
      { label: 'Simple descriptive language', description: 'Caregiver named textures calmly in short phrases matching baby’s focus.', weightPoints: 25 },
      { label: 'Close safety supervision', description: 'Caregiver remained seated within arm’s reach monitoring safe exploration.', weightPoints: 20 },
    ],
  },
  {
    ageSlug: '6-9m',
    domainSlug: 'cognitive',
    title: 'Muslin Scarf Peek-a-Boo Object Permanence',
    summary: 'Explore hidden-and-found play gently using a breathable cotton scarf and wooden ring.',
    durationMinutes: 5,
    materials: ['Light breathable muslin cloth', 'Smooth wooden ring or rattle'],
    safetyNotes: 'Never leave cloth over baby’s face; always keep peek-a-boo light, brief, and joyful.',
    posterUrl: EDITORIAL_IMAGES.heroMontessori,
    steps: [
      { title: 'Show the wooden ring clearly', instructionText: 'Place the wooden ring on the mat between you and baby so both of you see it.', caregiverTip: 'Let baby touch it briefly first.' },
      { title: 'Cover half the ring first', instructionText: 'Drape the light muslin scarf over half of the ring so one edge stays visible.', caregiverTip: 'Start easy so baby experiences success.' },
      { title: 'Ask warmly and wait', instructionText: 'Ask “Where did the wooden ring go?” and wait calmly with an encouraging smile.', caregiverTip: 'Give baby plenty of time to pull the scarf.' },
      { title: 'Celebrate calmly', instructionText: 'When the ring appears, say softly “There it is! You found the ring,” without startling loud noises.', caregiverTip: 'Repeat 2–3 times if baby stays engaged.' },
    ],
    rubric: [
      { label: 'Clear visual setup', description: 'Caregiver introduced the toy clearly before covering it.', weightPoints: 20 },
      { label: 'Partial-cover scaffolding', description: 'Caregiver started with the object partially visible to keep frustration low.', weightPoints: 30 },
      { label: 'Patient waiting pause', description: 'Caregiver waited calmly instead of pulling the cloth off immediately.', weightPoints: 30 },
      { label: 'Warm, calm narration', description: 'Caregiver spoke gently and clearly without overstimulating volume.', weightPoints: 20 },
    ],
  },
  {
    ageSlug: '6-9m',
    domainSlug: 'language',
    title: 'Everyday Kitchen Naming Rhyme',
    summary: 'Connect familiar household words with clear lip movement and soothing rhythm.',
    durationMinutes: 5,
    materials: ['Steel katori', 'Wooden spoon', 'Cotton napkin'],
    safetyNotes: 'Keep metal items lightweight with smooth rolled edges.',
    posterUrl: EDITORIAL_IMAGES.sensoryLinen,
    steps: [
      { title: 'Sit face-to-face on the mat', instructionText: 'Position yourself across from baby so they can see both your face and the object.', caregiverTip: 'Keep the other items tucked aside.' },
      { title: 'Hold one object near your cheek', instructionText: 'Lift the wooden spoon beside your face and say clearly: “Spoon. Wooden spoon.”', caregiverTip: 'Speak slightly slower than adult conversation.' },
      { title: 'Offer and pause', instructionText: 'Place the spoon on the mat in front of baby and wait for any babble, reach, or look.', caregiverTip: 'Respond to babbling as a real reply.' },
      { title: 'Repeat with rhythm', instructionText: 'Tap the wooden spoon gently twice on the mat and say “Tap, tap,” keeping the pace calm.', caregiverTip: 'Two objects per session is enough.' },
    ],
    rubric: [
      { label: 'Face-to-face visibility', description: 'Caregiver ensured baby could see both caregiver’s mouth and the object.', weightPoints: 25 },
      { label: 'Single-object focus', description: 'Caregiver introduced one item at a time without clutter.', weightPoints: 25 },
      { label: 'Clear, unhurried pronunciation', description: 'Caregiver used slow, simple everyday words.', weightPoints: 25 },
      { label: 'Responsive pauses', description: 'Caregiver paused after naming to welcome baby’s vocal or gesture response.', weightPoints: 25 },
    ],
  },
  {
    ageSlug: '6-9m',
    domainSlug: 'physical',
    title: 'Side-Reach Wooden Ring Roll',
    summary: 'Invite comfortable reaching and weight shifting on the floor mat.',
    durationMinutes: 6,
    materials: ['Firm woven floor mat', 'Smooth wooden ring or knitted cotton ball'],
    safetyNotes: 'Clear nearby hard furniture corners so baby has open floor space to shift safely.',
    posterUrl: EDITORIAL_IMAGES.heroMontessori,
    steps: [
      { title: 'Prepare open floor space', instructionText: 'Spread a firm mat away from sharp furniture edges so baby can move freely.', caregiverTip: 'Bare feet offer better grip on cotton mats.' },
      { title: 'Place ring slightly to one side', instructionText: 'Set the wooden ring just outside easy reach to baby’s right side.', caregiverTip: 'Keep it close enough to feel inviting.' },
      { title: 'Encourage without pulling', instructionText: 'Tap the mat lightly beside the ring and smile, allowing baby to shift or lean on their own.', caregiverTip: 'Avoid dragging baby forward by the arms.' },
      { title: 'Switch sides gently', instructionText: 'After baby grasps and explores, offer the next turn softly on the left side.', caregiverTip: 'Stop while baby is still smiling.' },
    ],
    rubric: [
      { label: 'Safe open mat space', description: 'Caregiver prepared a clear, firm floor area.', weightPoints: 25 },
      { label: 'Thoughtful reach distance', description: 'Caregiver placed the object slightly to the side without placing it frustratingly far.', weightPoints: 25 },
      { label: 'No physical forcing', description: 'Caregiver let baby initiate movement without pulling hands or torso.', weightPoints: 30 },
      { label: 'Balanced left-and-right invitation', description: 'Caregiver offered calm encouragement on both sides.', weightPoints: 20 },
    ],
  },
  {
    ageSlug: '6-9m',
    domainSlug: 'early-independence',
    title: 'Two-Handed Open Cup Sip Practice',
    summary: 'Introduce a tiny splash of water in a small open steel cup with calm guidance.',
    durationMinutes: 5,
    materials: ['Small baby-sized open steel cup (1–2 tsp water)', 'Soft linen napkin'],
    safetyNotes: 'Baby must be seated upright with steady head and trunk support. Use only 1–2 teaspoons of water at a time to prevent coughing.',
    posterUrl: EDITORIAL_IMAGES.everydayCup,
    steps: [
      { title: 'Ensure upright seating', instructionText: 'Seat baby comfortably upright in your lap or a supportive chair with the napkin nearby.', caregiverTip: 'Never offer liquids while reclined.' },
      { title: 'Pour a tiny amount', instructionText: 'Add just one or two teaspoons of water so tilting stays easy and mess stays small.', caregiverTip: 'Spills are completely normal practice.' },
      { title: 'Guide hands together', instructionText: 'Rest your hands gently over baby’s hands on the cup, bring the rim to the lower lip, and tip slightly.', caregiverTip: 'Pause after one small sip.' },
      { title: 'Wipe gently and narrate', instructionText: 'Set the cup down together and dab chin calmly with the napkin: “All done, warm cloth.”', caregiverTip: 'Keep the mood relaxed and encouraging.' },
    ],
    rubric: [
      { label: 'Upright safe seating', description: 'Caregiver ensured upright posture throughout drinking.', weightPoints: 30 },
      { label: 'Small water portion', description: 'Caregiver filled cup with only a tiny safe sip amount.', weightPoints: 20 },
      { label: 'Gentle hand-over-hand support', description: 'Caregiver tipped cup slowly and paused between sips.', weightPoints: 30 },
      { label: 'Calm wipe-and-narrate closure', description: 'Caregiver handled drips calmly without rushing or scolding.', weightPoints: 20 },
    ],
  },

  // 9-12 months
  {
    ageSlug: '9-12m',
    domainSlug: 'cognitive',
    title: 'In-and-Out Steel Katori Drop',
    summary: 'Explore container play by dropping knitted cotton balls into a wide steel bowl.',
    durationMinutes: 6,
    materials: ['Wide rounded steel katori', '2–3 soft knitted cotton balls'],
    safetyNotes: 'Ensure balls are larger than 4.5 cm so they cannot pose a choking hazard.',
    posterUrl: EDITORIAL_IMAGES.sensoryLinen,
    steps: [
      { title: 'Arrange neatly on the mat', instructionText: 'Place the steel bowl centered on the mat with two cotton balls resting on the left.', caregiverTip: 'Neat order invites curiosity.' },
      { title: 'Demonstrate once silently', instructionText: 'Pick up one ball slowly, drop it into the bowl with a soft sound, and pause.', caregiverTip: 'Slow hands teach better than long explanations.' },
      { title: 'Invite baby’s turn', instructionText: 'Say “Your turn” softly and sit back with relaxed hands.', caregiverTip: 'Let baby dump the bowl out too—that is part of learning.' },
      { title: 'Tidy together', instructionText: 'Place the balls back in the bowl calmly at the end and say “All tucked away.”', caregiverTip: 'Simple closing routines build calm habits.' },
    ],
    rubric: [
      { label: 'Ordered mat presentation', description: 'Caregiver presented bowl and balls neatly without clutter.', weightPoints: 25 },
      { label: 'Slow single demonstration', description: 'Caregiver modeled dropping one item slowly and clearly.', weightPoints: 25 },
      { label: 'Hands-off invitation', description: 'Caregiver let baby experiment with dropping and emptying freely.', weightPoints: 30 },
      { label: 'Calm tidy-up closure', description: 'Caregiver closed the activity with gentle narration.', weightPoints: 20 },
    ],
  },
  {
    ageSlug: '9-12m',
    domainSlug: 'social-emotional',
    title: 'Slow Goodbye Wave & Return Game',
    summary: 'Practice reassuring short separations around a doorway to build trust.',
    durationMinutes: 5,
    materials: ['Familiar room doorway'],
    safetyNotes: 'Keep baby in a completely safe floor space while you step just out of sight for 2 seconds.',
    posterUrl: EDITORIAL_IMAGES.heroMontessori,
    steps: [
      { title: 'Announce before stepping', instructionText: 'Wave calmly at eye level and say “Mama is stepping behind the door, I’ll be right back.”', caregiverTip: 'Never sneak away unexpectedly.' },
      { title: 'Step just out of sight briefly', instructionText: 'Pause 2 seconds while keeping your warm voice audible: “I’m right here!”', caregiverTip: 'Your voice bridges the moment.' },
      { title: 'Return warmly', instructionText: 'Step back in calmly smiling: “Mama came back!”', caregiverTip: 'Keep the tone steady rather than overly dramatic.' },
      { title: 'Offer a warm cuddle if sought', instructionText: 'Welcome baby with open arms and calm breathing.', caregiverTip: 'Builds everyday confidence for real goodbyes.' },
    ],
    rubric: [
      { label: 'Clear verbal cue before stepping', description: 'Caregiver told baby calmly before stepping out of sight.', weightPoints: 30 },
      { label: 'Reassuring vocal bridge', description: 'Caregiver kept a calm voice during the brief pause.', weightPoints: 25 },
      { label: 'Predictable warm return', description: 'Caregiver returned smoothly within 2–3 seconds.', weightPoints: 25 },
      { label: 'Emotionally attuned finish', description: 'Caregiver responded warmly to baby’s reaction.', weightPoints: 20 },
    ],
  },

  // 12-15 months
  {
    ageSlug: '12-15m',
    domainSlug: 'early-independence',
    title: 'Wooden Ring Stack & Linen Fold',
    summary: 'Practice purposeful hand coordination and gentle tidying on a low tabletop.',
    durationMinutes: 7,
    materials: ['Unpainted wooden ring stacker', 'Small folded linen cloth'],
    safetyNotes: 'Keep peg upright on a stable low table or floor mat while seated.',
    posterUrl: EDITORIAL_IMAGES.everydayCup,
    steps: [
      { title: 'Set out only 3 rings first', instructionText: 'Place the wooden post and just three rings beside it so the task feels achievable.', caregiverTip: 'You can add more rings on future days.' },
      { title: 'Show one deliberate ring placement', instructionText: 'Lift one ring with both hands, slide it slowly down the post, and pause.', caregiverTip: 'Move slower than feels natural.' },
      { title: 'Wait patiently', instructionText: 'Let toddler try, miss, adjust, and retry without grabbing the ring from their hand.', caregiverTip: 'Offer a quiet smile rather than constant praise.' },
      { title: 'Wipe or fold cloth to finish', instructionText: 'Invite toddler to place the cloth neatly beside the stacker when finished.', caregiverTip: 'Celebrates shared care of space.' },
    ],
    rubric: [
      { label: 'Manageable 3-ring setup', description: 'Caregiver simplified the activity to prevent overwhelm.', weightPoints: 25 },
      { label: 'Slow deliberate modeling', description: 'Caregiver demonstrated one step calmly with clear hand visibility.', weightPoints: 25 },
      { label: 'Patient non-interference', description: 'Caregiver allowed toddler to retry without taking over.', weightPoints: 30 },
      { label: 'Gentle closing routine', description: 'Caregiver modeled placing materials neatly afterward.', weightPoints: 20 },
    ],
  },
  {
    ageSlug: '12-15m',
    domainSlug: 'language',
    title: 'Everyday Object Choice & Naming',
    summary: 'Offer two familiar household items and celebrate pointing, gestures, and first words.',
    durationMinutes: 5,
    materials: ['Small open steel cup', 'Wooden spoon'],
    safetyNotes: 'Sit comfortably at toddler’s eye level on a floor mat.',
    posterUrl: EDITORIAL_IMAGES.everydayCup,
    steps: [
      { title: 'Hold two familiar items apart', instructionText: 'Hold the cup in one hand and wooden spoon in the other, clearly naming each once.', caregiverTip: 'Pause between the two names.' },
      { title: 'Ask an open calm question', instructionText: 'Ask “Would you like the cup or the spoon?” and wait patiently.', caregiverTip: 'Honor pointing, gazing, or sounds equally.' },
      { title: 'Confirm their choice', instructionText: 'Hand over the chosen item while naming it warmly: “You chose the cup!”', caregiverTip: 'Avoid quizzing or repeating “Say cup!”' },
      { title: 'Follow their play briefly', instructionText: 'Join quietly for 2 minutes following what they do with the item.', caregiverTip: 'Real choices motivate communication.' },
    ],
    rubric: [
      { label: 'Clear two-option presentation', description: 'Caregiver held items clearly spaced at eye level.', weightPoints: 25 },
      { label: 'Simple choice question + pause', description: 'Caregiver asked once and waited patiently.', weightPoints: 30 },
      { label: 'Honoring non-verbal & vocal cues', description: 'Caregiver responded warmly to pointing or sound without pressuring speech.', weightPoints: 25 },
      { label: 'Warm confirmation', description: 'Caregiver named the chosen item clearly when handing it over.', weightPoints: 20 },
    ],
  },

  // 15-18 months
  {
    ageSlug: '15-18m',
    domainSlug: 'early-independence',
    title: 'Cloth Wiping a Tiny Water Spill',
    summary: 'Turn everyday spills into calm, capable participation with a small cotton cloth.',
    durationMinutes: 6,
    materials: ['Small cotton cloth', 'Low table or tray', 'A few drops of water'],
    safetyNotes: 'Use only a few drops of water on a non-slip low table so the floor stays dry.',
    posterUrl: EDITORIAL_IMAGES.everydayCup,
    steps: [
      { title: 'Place a few drops on a tray', instructionText: 'Put a tiny splash of water on a low tray and place the folded cotton cloth beside it.', caregiverTip: 'Keep it playful and matter-of-fact.' },
      { title: 'Model wiping slowly', instructionText: 'Press the cloth gently onto the water and move in a slow circle: “Wipe, wipe.”', caregiverTip: 'Use calm, encouraging words.' },
      { title: 'Hand the cloth to toddler', instructionText: 'Invite toddler to wipe the remaining drops independently.', caregiverTip: 'Resist wiping over their work immediately.' },
      { title: 'Place cloth to dry together', instructionText: 'Walk together to place the damp cloth on a low hook or drying spot.', caregiverTip: 'Builds pride in everyday contribution.' },
    ],
    rubric: [
      { label: 'Prepared low workspace', description: 'Caregiver set up a safe, manageable spill size on a tray.', weightPoints: 25 },
      { label: 'Clear slow demonstration', description: 'Caregiver showed the wiping motion calmly before handing over.', weightPoints: 25 },
      { label: 'Encouraging independent attempt', description: 'Caregiver let toddler finish without criticizing or redoing immediately.', weightPoints: 30 },
      { label: 'Complete routine closure', description: 'Caregiver included putting the cloth away calmly.', weightPoints: 20 },
    ],
  },

  // 18-21 months
  {
    ageSlug: '18-21m',
    domainSlug: 'cognitive',
    title: 'Two-Basket Natural Matching',
    summary: 'Sort smooth wooden spoons and folded cotton cloths into two simple bowls.',
    durationMinutes: 7,
    materials: ['2 wide bowls or baskets', '3 wooden spoons', '3 folded muslin cloths'],
    safetyNotes: 'Use smooth, clean household items and supervise seated floor play.',
    posterUrl: EDITORIAL_IMAGES.sensoryLinen,
    steps: [
      { title: 'Create two clear anchors', instructionText: 'Place one wooden spoon in the left bowl and one folded cloth in the right bowl.', caregiverTip: 'Visual anchors reduce verbal instructions.' },
      { title: 'Model one match silently', instructionText: 'Pick up another spoon, look between bowls, and place it gently with the first spoon.', caregiverTip: 'Let toddler notice the visual match.' },
      { title: 'Offer remaining items one by one', instructionText: 'Hand one item at a time so toddler can decide where it belongs.', caregiverTip: 'If they mix them up, stay warm and curious.' },
      { title: 'Appreciate effort calmly', instructionText: 'Observe specifically: “You put all the soft cloths together.”', caregiverTip: 'Specific calm observation encourages focus.' },
    ],
    rubric: [
      { label: 'Clear visual anchor setup', description: 'Caregiver placed one anchor item in each bowl.', weightPoints: 25 },
      { label: 'One-by-one calm pacing', description: 'Caregiver offered items gradually without rushing.', weightPoints: 25 },
      { label: 'Supportive non-corrective tone', description: 'Caregiver allowed exploration without harsh correction.', weightPoints: 30 },
      { label: 'Specific calm reflection', description: 'Caregiver described what toddler did rather than generic rushing.', weightPoints: 20 },
    ],
  },

  // 21-24 months
  {
    ageSlug: '21-24m',
    domainSlug: 'social-emotional',
    title: 'Calm Naming of Everyday Feelings',
    summary: 'Use a low mirror and warm storytelling to name happy, sleepy, and calm faces together.',
    durationMinutes: 6,
    materials: ['Low mirror on cotton mat'],
    safetyNotes: 'Ensure mirror is firmly secured against a wall.',
    posterUrl: EDITORIAL_IMAGES.tummyMirror,
    steps: [
      { title: 'Sit side-by-side by the mirror', instructionText: 'Invite toddler to sit beside you facing the safe low mirror.', caregiverTip: 'Let toddler choose their comfortable seat.' },
      { title: 'Name one gentle feeling', instructionText: 'Make a soft smiling face and say “Warm happy face. Mama feels calm and happy.”', caregiverTip: 'Keep expressions authentic and gentle.' },
      { title: 'Invite imitation without pressure', instructionText: 'Ask “Can we try a sleepy yawn face together?” and pause playfully.', caregiverTip: 'Follow any expression toddler invents.' },
      { title: 'Practice one slow breath together', instructionText: 'Place hands on tummies and take one slow “smell the flower” breath to close.', caregiverTip: 'A soothing habit toddlers love reusing.' },
    ],
    rubric: [
      { label: 'Side-by-side mirror setup', description: 'Caregiver sat comfortably beside toddler at eye level.', weightPoints: 25 },
      { label: 'Clear, relatable feeling words', description: 'Caregiver named simple everyday emotions gently.', weightPoints: 25 },
      { label: 'Playful zero-pressure invitation', description: 'Caregiver followed toddler’s lead without forcing poses.', weightPoints: 25 },
      { label: 'Calming breath closure', description: 'Caregiver ended with a slow regulating transition.', weightPoints: 25 },
    ],
  },
];

export function seedDatabaseIfEmpty(db: Database.Database): void {
  const existingAgeGroups = db.prepare('SELECT COUNT(*) as count FROM age_groups').get() as {
    count: number;
  };
  if (existingAgeGroups.count > 0) {
    ensureStructuredDailyPlans(db);
    return;
  }

  const insertTransaction = db.transaction(() => {
    const ageGroupIds: Record<string, string> = {};
    const insertAge = db.prepare(
      `INSERT INTO age_groups (id, slug, label, min_months, max_months, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const group of CANONICAL_AGE_GROUPS) {
      const id = `ag_${group.slug}`;
      ageGroupIds[group.slug] = id;
      insertAge.run(id, group.slug, group.label, group.minMonths, group.maxMonths, group.sortOrder);
    }

    const domainIds: Record<string, string> = {};
    const insertDomain = db.prepare(
      `INSERT INTO learning_domains (id, slug, name, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const domain of CANONICAL_LEARNING_DOMAINS) {
      const id = `dom_${domain.slug}`;
      domainIds[domain.slug] = id;
      insertDomain.run(id, domain.slug, domain.name, domain.description, domain.sortOrder);
    }

    // Seed starter accounts across all 3 roles; staff passwords can be overridden via server env vars
    const parentPasswordHash = hashPassword('LittleSteps123!');
    const reviewerPasswordHash = hashPassword(
      readConfiguredPassword('REVIEWER_INITIAL_PASSWORD') ?? 'LittleSteps123!'
    );
    const adminPasswordHash = hashPassword(
      readConfiguredPassword('ADMIN_INITIAL_PASSWORD') ?? 'LittleSteps123!'
    );
    const parentId = 'usr_parent_meera';
    const reviewerId = 'usr_reviewer_ananya';
    const adminId = 'usr_admin_kavita';

    const insertUser = db.prepare(
      `INSERT INTO users (
         id, email, password_hash, full_name, phone_number, role, preferred_locale,
         email_verified_at, onboarding_completed_at, is_active
       )
       VALUES (
         ?, ?, ?, ?, ?, ?, 'en',
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         1
       )`
    );
    insertUser.run(parentId, 'meera@littlesteps.in', parentPasswordHash, 'Meera Deshmukh', '+91 98200 11223', 'parent');
    insertUser.run(reviewerId, 'ananya.reviewer@littlesteps.in', reviewerPasswordHash, 'Ananya Kulkarni', '+91 98200 44556', 'reviewer');
    insertUser.run(adminId, 'kavita.admin@littlesteps.in', adminPasswordHash, 'Kavita Nair', '+91 98200 77889', 'admin');

    db.prepare(
      `INSERT INTO user_consents (id, user_id, consent_type, policy_version, ip_hash)
       VALUES (?, ?, 'privacy_policy', 'v1.0', 'seeded'),
              (?, ?, 'video_processing', 'v1.0', 'seeded')`
    ).run(crypto.randomUUID(), parentId, crypto.randomUUID(), parentId);

    // Seed all starter activities, steps, and weighted rubrics
    const insertActivity = db.prepare(
      `INSERT INTO activities (
         id, age_group_id, domain_id, title, summary, duration_minutes,
         materials_json, safety_notes, instructional_poster_url, status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`
    );
    const insertStep = db.prepare(
      `INSERT INTO activity_steps (id, activity_id, step_number, title, instruction_text, caregiver_tip)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertRubric = db.prepare(
      `INSERT INTO activity_rubric_criteria (id, activity_id, criterion_order, label, description, weight_points)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const activitiesByAge: Record<string, string[]> = {};
    const rubricIdsByActivity: Record<string, Array<{ id: string; weight: number }>> = {};

    STARTER_ACTIVITIES.forEach((act, idx) => {
      const actId = `act_${String(idx + 1).padStart(2, '0')}`;
      const ageId = ageGroupIds[act.ageSlug];
      const domainId = domainIds[act.domainSlug];
      insertActivity.run(
        actId,
        ageId,
        domainId,
        act.title,
        act.summary,
        act.durationMinutes,
        JSON.stringify(act.materials),
        act.safetyNotes,
        act.posterUrl,
        adminId
      );
      activitiesByAge[act.ageSlug] = activitiesByAge[act.ageSlug] || [];
      activitiesByAge[act.ageSlug].push(actId);

      act.steps.forEach((step, sIdx) => {
        insertStep.run(
          `${actId}_step_${sIdx + 1}`,
          actId,
          sIdx + 1,
          step.title,
          step.instructionText,
          step.caregiverTip
        );
      });

      rubricIdsByActivity[actId] = [];
      act.rubric.forEach((crit, rIdx) => {
        const critId = `${actId}_rub_${rIdx + 1}`;
        insertRubric.run(critId, actId, rIdx + 1, crit.label, crit.description, crit.weightPoints);
        rubricIdsByActivity[actId].push({ id: critId, weight: crit.weightPoints });
      });
    });

    // Seed calm Daily Plans for every age group (2–3 focused activities per day)
    const insertPlan = db.prepare(
      `INSERT INTO daily_plans (id, age_group_id, day_number, title, focus_note)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertPlanItem = db.prepare(
      `INSERT INTO daily_plan_items (id, daily_plan_id, activity_id, sort_order)
       VALUES (?, ?, ?, ?)`
    );

    for (const group of CANONICAL_AGE_GROUPS) {
      const ageId = ageGroupIds[group.slug];
      const acts = activitiesByAge[group.slug] || [];
      if (acts.length === 0) continue;

      if (group.slug === '6-9m' && acts.length >= 5) {
        // Rich 3-day sequence for the demo parent's baby Aarav (7 months)
        const plan1 = `plan_${group.slug}_d1`;
        insertPlan.run(
          plan1,
          ageId,
          1,
          'Day 1 · Gentle Curiosity',
          'Take just 10 unhurried minutes across today. Pause whenever baby wants to rest.'
        );
        insertPlanItem.run(crypto.randomUUID(), plan1, acts[0], 1);
        insertPlanItem.run(crypto.randomUUID(), plan1, acts[1], 2);
        insertPlanItem.run(crypto.randomUUID(), plan1, acts[2], 3);

        const plan2 = `plan_${group.slug}_d2`;
        insertPlan.run(
          plan2,
          ageId,
          2,
          'Day 2 · Reaching & Everyday Sips',
          'Warm floor movement paired with a tiny, joyful sip from an open steel cup.'
        );
        insertPlanItem.run(crypto.randomUUID(), plan2, acts[3], 1);
        insertPlanItem.run(crypto.randomUUID(), plan2, acts[4], 2);

        const plan3 = `plan_${group.slug}_d3`;
        insertPlan.run(
          plan3,
          ageId,
          3,
          'Day 3 · Familiar Rhythms',
          'Repeating familiar activities builds deep comfort and confidence for babies.'
        );
        insertPlanItem.run(crypto.randomUUID(), plan3, acts[0], 1);
        insertPlanItem.run(crypto.randomUUID(), plan3, acts[3], 2);
      } else {
        const plan1 = `plan_${group.slug}_d1`;
        insertPlan.run(
          plan1,
          ageId,
          1,
          'Day 1 · Calm Discovery',
          'Choose one quiet window today when baby is rested and fed.'
        );
        acts.slice(0, 3).forEach((actId, idx) => {
          insertPlanItem.run(crypto.randomUUID(), plan1, actId, idx + 1);
        });
      }
    }

    // Seed Aarav (7 months old) for Meera Deshmukh
    const dob = new Date();
    dob.setMonth(dob.getMonth() - 7);
    const dobIso = dob.toISOString().slice(0, 10);
    const childId = 'ch_aarav_01';
    db.prepare(
      `INSERT INTO children (id, parent_user_id, display_name, date_of_birth, active_age_group_id)
       VALUES (?, ?, 'Aarav', ?, ?)`
    ).run(childId, parentId, dobIso, ageGroupIds['6-9m']);

    // Seed 1 reviewed activity completion with a real caregiver-execution rubric score
    // and privacy-deleted video demonstrating "Video deleted by parent · Feedback preserved"
    const todayIso = new Date().toISOString().slice(0, 10);
    const reviewedActivityId = activitiesByAge['6-9m'][0]; // Household Texture Basket
    const compId = 'comp_seed_01';
    db.prepare(
      `INSERT INTO activity_completions (id, child_id, activity_id, plan_date, status, caregiver_notes, completed_at)
       VALUES (?, ?, ?, ?, 'reviewed', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'))`
    ).run(
      compId,
      childId,
      reviewedActivityId,
      todayIso,
      'Aarav loved tapping the cool steel katori gently with the neem spoon.'
    );

    const subId = 'sub_seed_reviewed_01';
    const expiresDate = new Date(Date.now() + RETENTION_DAYS * 86400 * 1000).toISOString();
    db.prepare(
      `INSERT INTO video_submissions (
         id, completion_id, parent_user_id, child_id, activity_id,
         storage_key, mime_type, file_size_bytes, duration_seconds,
         review_status, assigned_reviewer_id, caregiver_notes,
         expires_at, deleted_at, deletion_reason, created_at
       ) VALUES (
         ?, ?, ?, ?, ?,
         NULL, 'video/webm', 4120000, 48,
         'reviewed', ?, 'Morning session by the sunlit window.',
         ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours'), 'parent_deleted',
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')
       )`
    ).run(subId, compId, parentId, childId, reviewedActivityId, reviewerId, expiresDate);

    const revId = 'rev_seed_01';
    db.prepare(
      `INSERT INTO submission_reviews (
         id, submission_id, reviewer_user_id, instruction_match_score_pct,
         strengths_note, coaching_tip, evaluation_scope_acknowledged_at, submitted_at
       ) VALUES (
         ?, ?, ?, 88,
         'Your mat setup was serene and uncluttered with three safe household items, and you stayed warmly at Aarav’s side without rushing.',
         'Next time, pause for 3–4 quiet seconds after naming “cool steel bowl” so baby has extra space to look back at your voice.',
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-20 hours'),
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-20 hours')
       )`
    ).run(revId, subId, reviewerId);

    const seedRubrics = rubricIdsByActivity[reviewedActivityId] || [];
    const insertRevScore = db.prepare(
      `INSERT INTO review_rubric_scores (id, review_id, rubric_criterion_id, achieved_level, earned_points, max_points)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    seedRubrics.forEach((r, idx) => {
      const level = idx === 2 ? 'partially_met' : 'met';
      const earned = level === 'met' ? r.weight : r.weight * 0.5;
      insertRevScore.run(crypto.randomUUID(), revId, r.id, level, earned, r.weight);
    });

    // Seed audit log history showing full privacy lifecycle
    const insertAudit = db.prepare(
      `INSERT INTO media_access_audit_logs (id, actor_user_id, actor_role, submission_id, action, created_at)
       VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?))`
    );
    insertAudit.run(crypto.randomUUID(), parentId, 'parent', subId, 'upload', '-24 hours');
    insertAudit.run(crypto.randomUUID(), reviewerId, 'reviewer', subId, 'review_open', '-21 hours');
    insertAudit.run(crypto.randomUUID(), reviewerId, 'reviewer', subId, 'stream', '-21 hours');
    insertAudit.run(crypto.randomUUID(), parentId, 'parent', subId, 'parent_delete', '-2 hours');
  });

  insertTransaction();
  ensureStructuredDailyPlans(db);
}

/**
 * Idempotently ensures rich 6-domain coverage, preparation-level metadata, and realistic
 * multi-day plans (Today + Upcoming Days) with zero duplicate activities per day.
 */
function ensureStructuredDailyPlans(db: Database.Database): void {
  const EXTRA_ACTIVITIES: Array<SeedActivityDef & { id: string; prepLevel: 'no_prep' | 'quick_setup' | 'guided_prep' }> = [
    {
      id: 'act_ext_6_9m_social',
      ageSlug: '6-9m',
      domainSlug: 'social-emotional',
      prepLevel: 'no_prep',
      title: 'Warm Mirror Greeting & Name Smile',
      summary: 'Strengthen joyful recognition and emotional security through unhurried side-by-side mirror smiles.',
      durationMinutes: 5,
      materials: ['Baby-safe low wall mirror', 'Soft cotton mat'],
      safetyNotes: 'Ensure the mirror is shatterproof and firmly secured against the wall.',
      posterUrl: EDITORIAL_IMAGES.tummyMirror,
      steps: [
        { title: 'Sit side-by-side comfortably', instructionText: 'Sit beside baby on the floor mat facing the low mirror so both of your reflections are clear.', caregiverTip: 'Keep your posture relaxed and warm.' },
        { title: 'Greet gently by name', instructionText: 'Wave softly at the reflection and say baby’s name followed by “and Mama are right here.”', caregiverTip: 'Pause so baby can study both faces.' },
        { title: 'Mirror baby’s expressions', instructionText: 'Gently reflect any smile, widened eyes, or happy sound baby makes without rushing.', caregiverTip: 'Warm mirroring builds emotional confidence.' },
      ],
      rubric: [
        { label: 'Safe low mirror positioning', description: 'Caregiver positioned baby safely beside a stable mirror.', weightPoints: 25 },
        { label: 'Warm side-by-side presence', description: 'Caregiver stayed at eye level sharing calm focus.', weightPoints: 25 },
        { label: 'Responsive mirroring & pauses', description: 'Caregiver echoed baby’s expressions and waited gently.', weightPoints: 50 },
      ],
    },
    {
      id: 'act_ext_0_3m_lang',
      ageSlug: '0-3m',
      domainSlug: 'language',
      prepLevel: 'no_prep',
      title: 'Soft Lullaby & Humming Pause',
      summary: 'Soothe and introduce natural speech rhythm with a slow family lullaby.',
      durationMinutes: 4,
      materials: ['Quiet room or sunlit corner'],
      safetyNotes: 'Hold baby securely supporting head and neck throughout.',
      posterUrl: EDITORIAL_IMAGES.heroMontessori,
      steps: [
        { title: 'Hold baby comfortably close', instructionText: 'Cradle baby gently with steady head support so they feel your calm breathing.', caregiverTip: 'Lower room lights slightly if bright.' },
        { title: 'Hum two slow lines', instructionText: 'Hum or sing a familiar lullaby slowly in a soft, natural speaking pitch.', caregiverTip: 'Avoid loud or sudden volume changes.' },
        { title: 'Pause and observe', instructionText: 'Pause quietly for 5 seconds to notice baby’s listening stillness or tiny vocalizations.', caregiverTip: 'Gentle repetition feels comforting to newborns.' },
      ],
      rubric: [
        { label: 'Safe supportive hold', description: 'Caregiver supported newborn head and neck securely.', weightPoints: 30 },
        { label: 'Calm slow vocal pacing', description: 'Caregiver sang or hummed softly without rushing.', weightPoints: 40 },
        { label: 'Attentive listening pause', description: 'Caregiver paused calmly to observe baby’s cues.', weightPoints: 30 },
      ],
    },
    {
      id: 'act_ext_0_3m_phys',
      ageSlug: '0-3m',
      domainSlug: 'physical',
      prepLevel: 'no_prep',
      title: 'Chest-to-Chest Gentle Head Lift',
      summary: 'Offer comfortable early tummy-time warmth resting calmly on your reclined chest.',
      durationMinutes: 3,
      materials: ['Cushioned backrest for caregiver'],
      safetyNotes: 'Stay fully awake and keep both hands supporting baby securely on your chest.',
      posterUrl: EDITORIAL_IMAGES.tummyMirror,
      steps: [
        { title: 'Recline comfortably', instructionText: 'Lean back at a gentle angle with pillows behind your shoulders.', caregiverTip: 'A relaxed angle makes lifting easier for newborns.' },
        { title: 'Place baby chest-to-chest', instructionText: 'Rest baby on their tummy over your chest with hands tucked comfortably by their face.', caregiverTip: 'Speak softly so they hear your familiar voice.' },
        { title: 'End while calm', instructionText: 'After 1–2 minutes or at early tiredness, gently roll baby back into a cradled hold.', caregiverTip: 'Short positive moments build steady comfort.' },
      ],
      rubric: [
        { label: 'Safe reclined support', description: 'Caregiver kept steady hands on baby throughout.', weightPoints: 40 },
        { label: 'Warm verbal encouragement', description: 'Caregiver spoke calmly at eye level.', weightPoints: 30 },
        { label: 'Short respectful duration', description: 'Caregiver ended gently before distress.', weightPoints: 30 },
      ],
    },
    {
      id: 'act_ext_3_6m_sens',
      ageSlug: '3-6m',
      domainSlug: 'sensory',
      prepLevel: 'quick_setup',
      title: 'Soft Cotton & Wooden Ring Grasp',
      summary: 'Invite curious two-handed reaching using a lightweight muslin cloth and smooth wooden ring.',
      durationMinutes: 5,
      materials: ['Smooth unfinished wooden ring', 'Soft cotton muslin cloth'],
      safetyNotes: 'Inspect wooden ring for smoothness and stay seated beside baby throughout.',
      posterUrl: EDITORIAL_IMAGES.sensoryLinen,
      steps: [
        { title: 'Lay baby comfortably on back', instructionText: 'Spread a firm cotton mat in soft daylight.', caregiverTip: 'Choose a calm alert window after feeds.' },
        { title: 'Present the ring slowly', instructionText: 'Hold the wooden ring steadily within easy reach above baby’s chest.', caregiverTip: 'Wait for baby to reach rather than placing it in their palm.' },
        { title: 'Describe simply', instructionText: 'When baby grasps or taps it, say warmly “Smooth wood ring.”', caregiverTip: 'Follow baby’s unhurried pace.' },
      ],
      rubric: [
        { label: 'Safe material inspection', description: 'Caregiver offered smooth, baby-safe natural items.', weightPoints: 30 },
        { label: 'Patient reach distance', description: 'Caregiver held object steadily for baby to reach.', weightPoints: 40 },
        { label: 'Calm naming', description: 'Caregiver narrated briefly without rushing.', weightPoints: 30 },
      ],
    },
    {
      id: 'act_ext_9_12m_phys',
      ageSlug: '9-12m',
      domainSlug: 'physical',
      prepLevel: 'quick_setup',
      title: 'Low Cushion Over-and-Around Crawl',
      summary: 'Encourage joyful floor balance with one firm folded bolster cushion on the mat.',
      durationMinutes: 6,
      materials: ['Firm cotton mat', '1 flat folded cotton cushion or bolster', 'Smooth wooden ring'],
      safetyNotes: 'Clear surrounding hard furniture edges and supervise closely.',
      posterUrl: EDITORIAL_IMAGES.heroMontessori,
      steps: [
        { title: 'Place one low cushion', instructionText: 'Set a firm, low folded cushion across the middle of the floor mat.', caregiverTip: 'Keep the height low and inviting.' },
        { title: 'Rest a familiar ring beyond', instructionText: 'Place the wooden ring calmly on the far side of the cushion.', caregiverTip: 'Let baby decide whether to crawl over or around.' },
        { title: 'Celebrate effort quietly', instructionText: 'Stay seated nearby smiling without lifting baby across.', caregiverTip: 'Independent problem-solving builds joyful confidence.' },
      ],
      rubric: [
        { label: 'Safe low obstacle setup', description: 'Caregiver cleared open space and used a stable low cushion.', weightPoints: 35 },
        { label: 'Independent movement invitation', description: 'Caregiver avoided dragging or lifting baby over.', weightPoints: 40 },
        { label: 'Calm warm encouragement', description: 'Caregiver stayed attentive at floor level.', weightPoints: 25 },
      ],
    },
    {
      id: 'act_ext_12_15m_sens',
      ageSlug: '12-15m',
      domainSlug: 'sensory',
      prepLevel: 'quick_setup',
      title: 'Warm & Cool Steel Bowl Touch',
      summary: 'Explore safe temperature contrast gently with two rounded steel bowls and a dry cloth.',
      durationMinutes: 6,
      materials: ['2 small steel katoris', 'Lukewarm water & cool room-temperature water', 'Cotton hand towel'],
      safetyNotes: 'Always test warm water on your inner wrist first—it should feel comfortably lukewarm, never hot.',
      posterUrl: EDITORIAL_IMAGES.sensoryLinen,
      steps: [
        { title: 'Prepare lukewarm & cool bowls', instructionText: 'Fill each bowl halfway with safe lukewarm or room-cool water on a low tray with a towel.', caregiverTip: 'Keep water shallow and calm.' },
        { title: 'Model dipping fingertips', instructionText: 'Dip your fingertips gently and name “Warm water” and “Cool water.”', caregiverTip: 'Move slowly and calmly.' },
        { title: 'Dry hands together', instructionText: 'Offer the soft cotton towel afterward so toddler practices wiping their own hands.', caregiverTip: 'Closing routines nurture independence.' },
      ],
      rubric: [
        { label: 'Safe temperature & tray setup', description: 'Caregiver prepared shallow safe water on a stable tray.', weightPoints: 35 },
        { label: 'Clear gentle naming', description: 'Caregiver named warm and cool clearly.', weightPoints: 35 },
        { label: 'Independent hand-drying finish', description: 'Caregiver invited toddler to dry hands calmly.', weightPoints: 30 },
      ],
    },
  ];

  const tx = db.transaction(() => {
    // 1. Set realistic prep_level on existing starter activities
    const prepUpdates: Array<[string, 'no_prep' | 'quick_setup' | 'guided_prep']> = [
      ['act_01', 'no_prep'],
      ['act_02', 'quick_setup'],
      ['act_03', 'quick_setup'],
      ['act_04', 'no_prep'],
      ['act_05', 'quick_setup'],
      ['act_06', 'no_prep'],
      ['act_07', 'quick_setup'],
      ['act_08', 'no_prep'],
      ['act_09', 'guided_prep'],
      ['act_10', 'quick_setup'],
      ['act_11', 'no_prep'],
      ['act_12', 'guided_prep'],
      ['act_13', 'no_prep'],
      ['act_14', 'guided_prep'],
      ['act_15', 'quick_setup'],
      ['act_16', 'no_prep'],
    ];
    const updatePrep = db.prepare('UPDATE activities SET prep_level = ? WHERE id = ?');
    for (const [id, level] of prepUpdates) {
      updatePrep.run(level, id);
    }

    // 2. Insert any additional domain-balancing activities idempotently
    const insertAct = db.prepare(
      `INSERT OR IGNORE INTO activities (
         id, age_group_id, domain_id, title, summary, duration_minutes, prep_level,
         materials_json, safety_notes, instructional_poster_url, status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'usr_admin_kavita')`
    );
    const insertStep = db.prepare(
      `INSERT OR IGNORE INTO activity_steps (id, activity_id, step_number, title, instruction_text, caregiver_tip)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertRubric = db.prepare(
      `INSERT OR IGNORE INTO activity_rubric_criteria (id, activity_id, criterion_order, label, description, weight_points)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (const act of EXTRA_ACTIVITIES) {
      const ageId = `ag_${act.ageSlug}`;
      const domId = `dom_${act.domainSlug}`;
      insertAct.run(
        act.id,
        ageId,
        domId,
        act.title,
        act.summary,
        act.durationMinutes,
        act.prepLevel,
        JSON.stringify(act.materials),
        act.safetyNotes,
        act.posterUrl
      );
      act.steps.forEach((s, idx) => {
        insertStep.run(`${act.id}_step_${idx + 1}`, act.id, idx + 1, s.title, s.instructionText, s.caregiverTip);
      });
      act.rubric.forEach((r, idx) => {
        insertRubric.run(`${act.id}_rub_${idx + 1}`, act.id, idx + 1, r.label, r.description, r.weightPoints);
      });
    }

    // 3. Ensure 6-9m Day 3 includes the 6th domain (Social & Emotional) without duplicating Day 1 activities unnecessarily
    const day3Plan = db
      .prepare("SELECT id FROM daily_plans WHERE age_group_id = 'ag_6-9m' AND day_number = 3")
      .get() as { id: string } | undefined;
    if (day3Plan) {
      const hasSocial = db
        .prepare("SELECT 1 FROM daily_plan_items WHERE daily_plan_id = ? AND activity_id = 'act_ext_6_9m_social'")
        .get(day3Plan.id);
      if (!hasSocial) {
        db.prepare('DELETE FROM daily_plan_items WHERE daily_plan_id = ?').run(day3Plan.id);
        db.prepare('UPDATE daily_plans SET title = ?, focus_note = ? WHERE id = ?').run(
          'Day 3 · Warm Connection & Independence',
          'Balance emotional closeness by the mirror with calm, everyday floor confidence.',
          day3Plan.id
        );
        const insItem = db.prepare(
          'INSERT OR IGNORE INTO daily_plan_items (id, daily_plan_id, activity_id, sort_order) VALUES (?, ?, ?, ?)'
        );
        insItem.run(crypto.randomUUID(), day3Plan.id, 'act_ext_6_9m_social', 1);
        insItem.run(crypto.randomUUID(), day3Plan.id, 'act_08', 2);
      }
    }

    // 4. Ensure every other age band with >= 3 activities has a structured Day 2 upcoming plan with zero duplicates
    const multiDaySeeds: Array<{
      ageSlug: string;
      dayNumber: number;
      title: string;
      focusNote: string;
      activityIds: string[];
    }> = [
      {
        ageSlug: '0-3m',
        dayNumber: 2,
        title: 'Day 2 · Soft Voices & Warmth',
        focusNote: 'Two unhurried moments of voice rhythm and supported chest-to-chest bonding.',
        activityIds: ['act_ext_0_3m_lang', 'act_ext_0_3m_phys'],
      },
      {
        ageSlug: '3-6m',
        dayNumber: 2,
        title: 'Day 2 · Curious Reaching',
        focusNote: 'Pair soft cotton texture exploration with gentle vocal turn-taking.',
        activityIds: ['act_ext_3_6m_sens', 'act_04'],
      },
      {
        ageSlug: '9-12m',
        dayNumber: 2,
        title: 'Day 2 · Steady Floor Movement',
        focusNote: 'Build floor balance and warm confidence around familiar spaces.',
        activityIds: ['act_ext_9_12m_phys', 'act_11'],
      },
      {
        ageSlug: '12-15m',
        dayNumber: 2,
        title: 'Day 2 · Everyday Senses & Choices',
        focusNote: 'Calm sensory discovery followed by meaningful two-item everyday choices.',
        activityIds: ['act_ext_12_15m_sens', 'act_13'],
      },
    ];

    const insertPlan = db.prepare(
      `INSERT OR IGNORE INTO daily_plans (id, age_group_id, day_number, title, focus_note)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertItem = db.prepare(
      `INSERT OR IGNORE INTO daily_plan_items (id, daily_plan_id, activity_id, sort_order)
       VALUES (?, ?, ?, ?)`
    );

    for (const seedPlan of multiDaySeeds) {
      const ageId = `ag_${seedPlan.ageSlug}`;
      const existing = db
        .prepare('SELECT id FROM daily_plans WHERE age_group_id = ? AND day_number = ?')
        .get(ageId, seedPlan.dayNumber) as { id: string } | undefined;
      if (!existing) {
        const planId = `plan_${seedPlan.ageSlug}_d${seedPlan.dayNumber}`;
        insertPlan.run(planId, ageId, seedPlan.dayNumber, seedPlan.title, seedPlan.focusNote);
        seedPlan.activityIds.forEach((actId, idx) => {
          insertItem.run(crypto.randomUUID(), planId, actId, idx + 1);
        });
      }
    }
  });

  tx();
}

/**
 * Applies server-configured staff passwords (ADMIN_INITIAL_PASSWORD / REVIEWER_INITIAL_PASSWORD)
 * when set in environment variables so operators can immediately rotate starter passwords
 * without modifying code or exposing credentials to the browser.
 */
export function syncConfiguredStaffPasswords(db: Database.Database): void {
  const targets: Array<{ email: string; envName: string }> = [
    { email: 'kavita.admin@littlesteps.in', envName: 'ADMIN_INITIAL_PASSWORD' },
    { email: 'ananya.reviewer@littlesteps.in', envName: 'REVIEWER_INITIAL_PASSWORD' },
  ];

  for (const target of targets) {
    const configured = readConfiguredPassword(target.envName);
    if (!configured) continue;

    const existing = db
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .get(target.email) as { id: string; password_hash: string } | undefined;

    if (existing && !verifyPassword(configured, existing.password_hash)) {
      db.prepare(
        `UPDATE users
         SET password_hash = ?, session_version = session_version + 1
         WHERE id = ?`
      ).run(hashPassword(configured), existing.id);
    }
  }
}

