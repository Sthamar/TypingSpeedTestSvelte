<script>
	import { onMount } from "svelte";

	let testText = "The quick brown fox jumps over the lazy dog.";
	let userText = "";
	let timeLeft = 30;
	let timerActive = false;
	let timer;
	let wpm = 0;
	let accuracy = 0;

	// Start the timer
	const startTimer = () => {
		if (timerActive) return;

		timerActive = true;
		timer = setInterval(() => {
			if (timeLeft > 0) {
				timeLeft--;
			} else {
				clearInterval(timer); // Stop the timer when timeLeft reaches 0
				calculateResults();   // Calculate results
				timerActive = false;
			}
		}, 1000);
	};

	// Calculate WPM and Accuracy
	const calculateResults = () => {
		const wordsTyped = userText.trim().split(" ").length;
		const correctChars = Array.from(userText).filter(
			(char, idx) => char === testText[idx]
		).length;
		const totalChars = testText.length;

		wpm = Math.round((wordsTyped / (30 - timeLeft)) * 60); // Words per minute
		accuracy = Math.round((correctChars / totalChars) * 100); // Accuracy percentage
	};

	// Reset the test
	const resetTest = () => {
		clearInterval(timer);
		userText = "";
		timeLeft = 30;
		timerActive = false;
		wpm = 0;
		accuracy = 0;
	};

	// Reactive: Stop the timer when user completes the text
	$: {
		if (userText.trim() === testText.trim() && timeLeft > 0) {
			clearInterval(timer); // Stop the timer
			calculateResults();   // Calculate results
			timerActive = false;
		}
	}
</script>

<style>
	h1 {
		text-align: center;
		color: #007acc;
	}
	textarea {
		width: 100%;
		height: 100px;
		margin: 20px 0;
		font-size: 1.2em;
		padding: 10px;
	}
	button {
		background-color: #007acc;
		color: white;
		padding: 10px 20px;
		border: none;
		border-radius: 5px;
		cursor: pointer;
	}
	button:hover {
		background-color: #005fa3;
	}
	div {
		max-width: 600px;
		margin: 0 auto;
		text-align: center;
	}
</style>

<main>
	<div>
		<h1>Typing Speed Test</h1>
		<p><strong>Time Left:</strong> {timeLeft} seconds</p>
		<p><strong>Test Text:</strong> {testText}</p>

		<textarea 
			bind:value={userText}
			placeholder="Start typing here..."
			on:focus={startTimer}
			disabled={timeLeft === 0}
		></textarea>

		{#if timeLeft === 0 || userText.trim() === testText.trim()}
			<div>
				<h2>Results</h2>
				<p><strong>WPM:</strong> {wpm}</p>
				<p><strong>Accuracy:</strong> {accuracy}%</p>
				<button on:click={resetTest}>Restart Test</button>
			</div>
		{/if}
	</div>
</main>
