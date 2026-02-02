
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const setupGame = (playerCount) => {
  if (playerCount < 4 || playerCount > 6) {
    throw new Error('Number of players must be between 4 and 6.');
  }

  // 1. Role Assignment
  let sherlockCount, moriartyCount;
  if (playerCount <= 5) {
    sherlockCount = 3;
    moriartyCount = 2;
  } else { // 6 players
    sherlockCount = 4;
    moriartyCount = 2;
  }

  let roles = [];
  for (let i = 0; i < sherlockCount; i++) roles.push('Sherlock');
  for (let i = 0; i < moriartyCount; i++) roles.push('Moriarty');
  
  roles = shuffle(roles);
  
  // For 4 players, one role card is set aside
  const playerRoles = roles.slice(0, playerCount);

  // 2. Wire Card Dealing
  const BOMB_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'black'];
  
  // Select bomb colors equal to the number of players
  const bombColorsInGame = BOMB_COLORS.slice(0, playerCount);
  
  // Create the bomb card pile: 5 of each color
  let wireCardPile = [];
  bombColorsInGame.forEach(color => {
    for (let i = 0; i < 5; i++) {
      wireCardPile.push({ type: 'Bomb', color: color });
    }
  });

  // Shuffle and remove a number of cards equal to the player count
  wireCardPile = shuffle(wireCardPile);
  wireCardPile = wireCardPile.slice(0, wireCardPile.length - playerCount);

  // Add "Success" cards
  for (let i = 0; i < playerCount; i++) {
    wireCardPile.push({ type: 'Success' });
  }

  // Shuffle the final pile
  wireCardPile = shuffle(wireCardPile);

  // Deal 5 cards to each player
  const playerHands = [];
  for (let i = 0; i < playerCount; i++) {
    const hand = wireCardPile.slice(i * 5, (i + 1) * 5);
    playerHands.push({ playerId: i, role: playerRoles[i], hand: hand });
  }

  return { playerSetups: playerHands };
};

module.exports = { setupGame };
