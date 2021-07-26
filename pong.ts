import { interval, fromEvent, from, zip, Subscription } from 'rxjs'
import { map, scan, filter, merge, flatMap, take, concat, takeUntil, withLatestFrom, subscribeOn } from 'rxjs/operators'

function pong() {
  // Inside this function you will use the classes and functions 
  // from rx.js
  // to add visuals to the svg element in pong.html, animate them, and make them interactive.
  // Study and complete the tasks in observable exampels first to get ideas.
  // Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/ 
  // You will be marked on your functional programming style
  // as well as the functionality that you implement.
  // Document your code!

  // Michael-Laifu Chhua 30578213

  const botPaddleSpeed = 2 // the amount the paddle can move per interval
  const yAcceleration = 0.5 // the amount increased to the y velocity each time a paddle hits the ball


  type PaddleState = Readonly<{
    x: number; // x position of paddle, which will be the same 
    y: number; // y position of paddle
  }>

  type BallState = Readonly<{
    x: number; // x position of ball
    y: number; // y position of ball
    xVel: number; // velocity of ball in x direction
    yVel: number; // velocity of ball in y direction
    ballDirectionX: number, // direction in x axis
    ballDirectionY: number; // direction in y axis
  }>

  type OverallState = Readonly<{
    // the overall game state, does not contain player paddle state
    botState: PaddleState;
    ballState: BallState;
    playerScore: number;
    botScore: number;
    gameOver: boolean; // boolean that triggers the unsubscribe 
  }>

  function paddleMove(s: PaddleState, y: number): PaddleState {
    // checks if the paddles new position is within boundary of the canvas
    return {
      x: s.x,
      y: s.y + y >= 0 && s.y + y <= 565 ? s.y + y : s.y
    }
  }

  function botMove(s: OverallState): PaddleState {
    // function to make the bot try to keep its center with the ball's center, moving at a certain paddle speed
    return {
      x: s.botState.x,
      y: s.botState.y + 17.5 > s.ballState.y + 5 ? s.botState.y - botPaddleSpeed : s.botState.y + botPaddleSpeed
    }
  }

  function ballAndBotMove(s: OverallState, p: PaddleState): OverallState {
    // function that manages the ball and bot paddle's state

    // returns an OverallState object that handles the ball hitting the player paddle
    if (playerPaddleCollide(p, s)) {
      return {
        botState: botMove(s),
        ballState: {
          x: s.ballState.x - s.ballState.xVel * s.ballState.ballDirectionX, // x direction of ball is reversed
          y: s.ballState.y + 5 < p.y + 17.5 ? s.ballState.y - s.ballState.yVel : s.ballState.y + s.ballState.yVel,
          // y direction changes depending on what part of the paddle the ball hits.
          xVel: s.ballState.xVel,
          yVel: s.ballState.yVel + yAcceleration, // each time the bot or player paddle hits the ball, the y velocity of the ball increases
          ballDirectionX: -1 * s.ballState.ballDirectionX, // ball direction is reversed in x
          ballDirectionY: s.ballState.y + 5 < p.y + 17.5 ? -1 : 1 // ball direction is reversed in y based on what part of the paddle the ball hits
        },
        playerScore: s.playerScore,
        botScore: s.botScore,
        gameOver: s.playerScore === 7 || s.botScore === 7 // when either player or bot scores 7 points, gameOver is true and the game stops
      }
    }

    else if (botPaddleCollide(s)) {
      // same thing here except it handles it for the bot paddle
      return {
        botState: botMove(s),
        ballState: {
          x: s.ballState.x - s.ballState.xVel * s.ballState.ballDirectionX,
          y: s.ballState.y + 5 < s.botState.y + 17.5 ? s.ballState.y - s.ballState.yVel : s.ballState.y + s.ballState.yVel,
          xVel: s.ballState.xVel,
          yVel: s.ballState.yVel + yAcceleration,
          ballDirectionX: -1 * s.ballState.ballDirectionX,
          ballDirectionY: s.ballState.y + 5 < s.botState.y + 17.5 ? -1 : 1
        },
        playerScore: s.playerScore,
        botScore: s.botScore,
        gameOver: s.playerScore === 7 || s.botScore === 7
      }
    }

    else if (wallCollideRight(s)) {
      // returns an OverallState object that handles the ball hitting the right wall
      return {
        botState: botMove(s),
        ballState: initialBallState, // the ball is now in the center again, ball is served towards the player, since the player lost the round
        playerScore: s.playerScore,
        botScore: s.botScore + 1, // the bot's score is increased by 1 since it scored the point
        gameOver: s.playerScore === 7 || s.botScore === 7
      }
    }

    else if (wallCollideLeft(s)) {
      // same thing here except it handles for the left wall
      return {
        botState: botMove(s),
        ballState: {
          ...initialBallState,
          ballDirectionX: -1, // the ball is now in the center again, ball is served in the opposite direction towards the bot, since the bot lost the round
          ballDirectionY: -1
        },
        playerScore: s.playerScore + 1, // the player's score is increased by 1 since the player scored the point
        botScore: s.botScore,
        gameOver: s.playerScore === 7 || s.botScore === 7
      }
    }
    else {
      return {
        // returns an OverallState object for when the ball is travelling and not being hit by the paddles or left or right walls
        botState: botMove(s),
        ballState: {
          x: s.ballState.x + s.ballState.xVel * s.ballState.ballDirectionX,
          y: wallCollideY(s) ? s.ballState.y - s.ballState.yVel * s.ballState.ballDirectionY : s.ballState.y + s.ballState.yVel * s.ballState.ballDirectionY,
          // checks if the ball hits the top or bottom walls and changes the direction of y if it does
          xVel: s.ballState.xVel,
          yVel: s.ballState.yVel,
          ballDirectionX: s.ballState.ballDirectionX,
          ballDirectionY: wallCollideY(s) ? -1 * s.ballState.ballDirectionY : s.ballState.ballDirectionY // flip direction of y if ball hits top or bottom walls
        },
        playerScore: s.playerScore,
        botScore: s.botScore,
        gameOver: s.playerScore === 7 || s.botScore === 7
      }
    }
  }
  function overlappingIntervals(u: number, U: number, v: number, V: number): boolean {
    //taken from week 2 workshop and transformed into non arrow, non curried syntax
    // used to check if ball collides with the paddles, that is if their x and y positions overlap
    return !(U < v || V < u); // 
  }

  function playerPaddleCollide(paddle: PaddleState, ballAndBot: OverallState): boolean {
    return overlappingIntervals(ballAndBot.ballState.x, ballAndBot.ballState.x + 10, paddle.x, paddle.x + 10) // checks if x positions of ball and player paddle overlap
      &&
      overlappingIntervals(ballAndBot.ballState.y, ballAndBot.ballState.y + 10, paddle.y, paddle.y + 35) // checks if y position of ball and player overlap
  }

  function botPaddleCollide(ballAndBot: OverallState): boolean {
    return overlappingIntervals(ballAndBot.ballState.x, ballAndBot.ballState.x + 10, ballAndBot.botState.x, ballAndBot.botState.x + 10) // similar thing for bot paddle
      &&
      overlappingIntervals(ballAndBot.ballState.y, ballAndBot.ballState.y + 10, ballAndBot.botState.y, ballAndBot.botState.y + 35)
  }

  function wallCollideY(s: OverallState): boolean {
    // checks if ball hits top or bottom walls
    return (s.ballState.y + 10 >= 600 || s.ballState.y <= 0)
  }

  function wallCollideLeft(s: OverallState): boolean {
    // checks if ball hits the left wall
    return (s.ballState.x <= 0)
  }

  function wallCollideRight(s: OverallState): boolean {
    // checks if ball hits the right wall 
    return (s.ballState.x + 10 >= 600)
  }

  function updateView(s: OverallState): void {
    // function to update the view of everything besides the player paddle
    const bot = document.getElementById("bot")!;
    const ball = document.getElementById("ball")!;
    const botScore = document.getElementById("botscore")!;
    const playerScore = document.getElementById("playerscore")!;
    const message = document.getElementById("winText")

    bot.setAttribute('transform', `translate(20,${s.botState.y})`)
    ball.setAttribute('transform', `translate(${s.ballState.x},${s.ballState.y})`)
    botScore.textContent = s.botScore.toString() // update scores of bot and player score
    playerScore.textContent = s.playerScore.toString()

    if (s.gameOver) {
      // if either bot or player reaches 7 points, unsubscribe all streams to stop game 
      game.unsubscribe()
      playerMovement.unsubscribe()
      if (s.botScore >= 7) {
        message.textContent = "Bot Wins :("
      }
      else {
        message.textContent = "You Win!!!"
      }
    }
  }

  function updatePlayerView(state: PaddleState): void {
    // separate update functionfor the player paddle
    const player = document.getElementById("player")!;
    player.setAttribute('transform', `translate(565,${state.y})`)
  }

  const
    // the initial values of the states
    initialPlayerState: PaddleState = { x: 565, y: 282.5 },
    initialBotState: PaddleState = { x: 20, y: 282.5 },
    initialBallState: BallState = { x: 295, y: 295, xVel: 3, yVel: 0, ballDirectionX: 1, ballDirectionY: 1 },
    initialOverallState: OverallState = { botState: initialBotState, ballState: initialBallState, playerScore: 0, botScore: 0, gameOver: false }

  const keydown$ = fromEvent<KeyboardEvent>(document, 'keydown');
  const arrowKeys$ = keydown$.pipe(
    filter(({ key }) => key === 'ArrowUp' || key === 'ArrowDown'),
    // Tim's code that somehow makes the player paddle movement smoother
    filter(({ repeat }) => !repeat),
    flatMap(d => interval(10).pipe(
      takeUntil(fromEvent<KeyboardEvent>(document, 'keyup').pipe(
        filter(({ code }) => code === d.code)
      )),
      map(_ => d))
    ));

  const playerMove = arrowKeys$.pipe(map(e => e.key === 'ArrowUp' ? -7 : 7), // player paddle moves at a speed of 7
    scan((paddle, number) => paddleMove(paddle, number), initialPlayerState))
  // player paddle movement updates gets its own observable stream which is later merged with the main stream
  const playerMovement = playerMove.subscribe(s => updatePlayerView(s)) // player paddle view updates are handled in a separate subscription


  // check for collision and update bot movement within the same method and scan
  // player movement stream is merged with the main stream using withLatestFrom. withLatestFrom will keep the last state that came out of the player movement stream
  // while the interval keeps ticking and updating. It keeps the other state updating while the player paddle isn't being updated.
  const ballAndBotMovement = interval(10).pipe(withLatestFrom(playerMove), map(([first, second]) => second),
    scan((overall, paddle) => ballAndBotMove(overall, paddle), initialOverallState))

  const game = ballAndBotMovement.subscribe(s => updateView(s))

}




// the following simply runs your pong function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
  window.onload = () => {
    pong();
  }



