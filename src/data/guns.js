const GUNS_LOCAL = [
  {
    id: 'local-1',
    name: 'Glock 19 Gen 5',
    type: 'Pistol',
    caliber: '9mm Luger',
    price: 599,
    description: 'Compact striker-fired service pistol with flared magwell, GMB barrel, and ambidextrous slide stop lever.',
    image_url: '/guns/pistol.svg',
    images: ['/guns/pistol.svg', '/guns/rifle.svg'],
    ingredients: [
      { id: 's1', name: 'Frame', quantity: 'Polymer' },
      { id: 's2', name: 'Capacity', quantity: '15+1 Rounds' },
      { id: 's3', name: 'Barrel Length', quantity: '4.02 in' },
    ],
    steps: [
      'Remove magazine and visually/physically inspect chamber.',
      'Pull trigger in safe direction, pull down slide lock, and slide assembly forward.',
    ],
  },
  {
    id: 'local-2',
    name: 'Colt M4A1 Carbine',
    type: 'Rifle',
    caliber: '5.56x45mm NATO',
    price: 1299,
    description: 'Direct-impingement gas-operated carbine with chrome-lined 14.5-inch barrel and Picatinny flat-top receiver.',
    image_url: '/guns/rifle.svg',
    images: ['/guns/rifle.svg', '/guns/shotgun.svg'],
    ingredients: [
      { id: 's1', name: 'Receiver', quantity: '7075-T6 Aluminum' },
      { id: 's2', name: 'Twist Rate', quantity: '1:7 RH' },
      { id: 's3', name: 'Weight', quantity: '6.9 lbs' },
    ],
    steps: [
      'Clear weapon, push takedown pin, and pivot upper receiver.',
      'Withdraw bolt carrier group and charging handle for lubrication.',
    ],
  },
  {
    id: 'local-3',
    name: 'Benelli M4 Tactical',
    type: 'Shotgun',
    caliber: '12 Gauge',
    price: 1999,
    description: 'Auto-Regulating Gas-Operated (A.R.G.O.) combat shotgun with ghost-ring sights and Picatinny optics rail.',
    image_url: '/guns/shotgun.svg',
    images: ['/guns/shotgun.svg', '/guns/pistol.svg'],
    ingredients: [
      { id: 's1', name: 'System', quantity: 'A.R.G.O. Dual Piston' },
      { id: 's2', name: 'Barrel Length', quantity: '18.5 in' },
      { id: 's3', name: 'Capacity', quantity: '5+1 Shells' },
    ],
    steps: [
      'Ensure magazine tube and chamber are completely clear.',
      'Unscrew forend cap and remove barrel assembly from receiver.',
    ],
  },
]

export default GUNS_LOCAL
