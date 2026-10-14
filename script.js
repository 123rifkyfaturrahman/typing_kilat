const { createApp, ref, computed, onMounted, nextTick } = Vue

const wordPools = {
    id: [
        "teknologi", "pemrograman", "kecerdasan", "buatan", "algoritma", "variabel", "fungsi", "komputer",
        "jaringan", "database", "sistem", "aplikasi", "pengembang", "rekayasa", "perangkat", "lunak",
        "internet", "struktur", "data", "keamanan", "siber", "server", "klien", "antarmuka", "desain",
        "logika", "eksekusi", "pengujian", "optimasi", "efisiensi", "performa", "lomba", "kecepatan",
        "ketangkasan", "fokus", "akurasi", "konsentrasi", "konsistensi", "tantangan", "papan", "skor",
        "pengalaman", "kreativitas", "solusi", "digital", "inovasi", "modern", "otomatisasi", "analisis"
    ],
    en: [
        "technology", "programming", "artificial", "intelligence", "algorithm", "variable", "function", "computer",
        "network", "database", "system", "application", "developer", "engineering", "software", "hardware",
        "internet", "structure", "data", "cyber", "security", "server", "client", "interface", "design",
        "logic", "execution", "testing", "optimization", "efficiency", "performance", "contest", "speed",
        "dexterity", "focus", "accuracy", "concentration", "consistency", "challenge", "leaderboard", "score",
        "experience", "creativity", "solution", "digital", "innovation", "modern", "automation", "analysis"
    ]
}

createApp({
    setup() {
        const lang = ref('id')
        const timeLimit = ref(30)
        const soundEnabled = ref(true)
        
        const totalWordsTarget = ref(200)
        const batchSize = 15
        
        const isStarted = ref(false)
        const isFinished = ref(false)
        const timeLeft = ref(30)
        const currentInput = ref('')
        const typingInput = ref(null)

        const allWordsPool = ref([])
        const currentBatchIndex = ref(0)
        const currentBatchWords = ref([])
        const currentWordIndex = ref(0)
        const currentCharIndex = ref(0)

        const correctCharsCount = ref(0)
        const totalTypedChars = ref(0)
        const totalCompletedWords = ref(0)
        const perfectWordsCount = ref(0)
        
        let timer = null
        const leaderboard = ref([])

        let audioCtx = null
        const initAudio = () => {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)()
            }
        }

        const playKeySound = (type = 'normal') => {
            if (!soundEnabled.value) return
            try {
                initAudio()
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume()
                }

                const osc = audioCtx.createOscillator()
                const gain = audioCtx.createGain()
                
                let freq = 900 + Math.random() * 350
                let gainValue = 0.4

                if (type === 'space') { freq = 320; gainValue = 0.5; }
                if (type === 'backspace') { freq = 550; gainValue = 0.45; }
                if (type === 'error') { freq = 180; gainValue = 0.6; }

                osc.type = 'triangle'
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
                gain.gain.setValueAtTime(gainValue, audioCtx.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05)

                osc.connect(gain)
                gain.connect(audioCtx.destination)

                osc.start()
                osc.stop(audioCtx.currentTime + 0.05)
            } catch (e) {
                console.error("Audio error:", e)
            }
        }

        const generateRandomWords = (count = 200) => {
            const pool = wordPools[lang.value]
            const result = []
            for (let i = 0; i < count; i++) {
                const randomWord = pool[Math.floor(Math.random() * pool.length)]
                const chars = randomWord.split('').map(c => ({ val: c, status: 'pending' }))
                chars.push({ val: ' ', status: 'pending' })
                result.push({ word: randomWord, chars: chars })
            }
            return result
        }

        const loadNextBatch = () => {
            const start = currentBatchIndex.value * batchSize
            const end = start + batchSize
            
            if (start >= allWordsPool.value.length) {
                endTest()
                return
            }

            currentBatchWords.value = JSON.parse(JSON.stringify(allWordsPool.value.slice(start, end)))
            currentWordIndex.value = 0
            currentCharIndex.value = 0
            currentInput.value = ''
        }

        const initText = () => {
            allWordsPool.value = generateRandomWords(totalWordsTarget.value)
            currentBatchIndex.value = 0
            totalCompletedWords.value = 0
            perfectWordsCount.value = 0
            correctCharsCount.value = 0
            totalTypedChars.value = 0
            
            isStarted.value = false
            isFinished.value = false
            timeLeft.value = timeLimit.value
            clearInterval(timer)

            loadNextBatch()
        }

        const setLanguage = (newLang) => {
            lang.value = newLang
            initText()
            nextTick(() => focusInput())
        }

        const setTimeLimit = (t) => {
            timeLimit.value = t
            initText()
            nextTick(() => focusInput())
        }

        const focusInput = () => {
            if (!isFinished.value && typingInput.value) {
                typingInput.value.focus()
            }
        }

        const isCurrentChar = (wIdx, cIdx) => {
            return wIdx === currentWordIndex.value && cIdx === currentCharIndex.value
        }

        const handleInput = (e) => {
            if (isFinished.value) return

            if (!isStarted.value) {
                isStarted.value = true
                startTimer()
            }

            const val = currentInput.value
            if (val.length === 0) return

            const lastChar = val[val.length - 1]
            const targetWordObj = currentBatchWords.value[currentWordIndex.value]
            if (!targetWordObj) return

            const targetCharObj = targetWordObj.chars[currentCharIndex.value]

            if (targetCharObj) {
                totalTypedChars.value++
                if (lastChar === targetCharObj.val) {
                    targetCharObj.status = 'correct'
                    correctCharsCount.value++
                    playKeySound(targetCharObj.val === ' ' ? 'space' : 'normal')
                } else {
                    targetCharObj.status = 'incorrect'
                    playKeySound('error')
                }

                currentCharIndex.value++

                if (currentCharIndex.value >= targetWordObj.chars.length) {
                    totalCompletedWords.value++

                    const isWordPerfect = targetWordObj.chars.every(c => c.status === 'correct')
                    if (isWordPerfect) {
                        perfectWordsCount.value++
                    }

                    currentWordIndex.value++
                    currentCharIndex.value = 0
                    currentInput.value = ''

                    if (currentWordIndex.value >= currentBatchWords.value.length) {
                        currentBatchIndex.value++
                        loadNextBatch()
                    }
                }
            }
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Tab' || e.key === 'Escape') {
                e.preventDefault()
                resetTest()
            }
            if (e.key === 'Backspace') {
                playKeySound('backspace')
                
                if (currentCharIndex.value > 0) {
                    currentCharIndex.value--
                    const targetCharObj = currentBatchWords.value[currentWordIndex.value].chars[currentCharIndex.value]
                    if (targetCharObj.status === 'correct' && correctCharsCount.value > 0) {
                        correctCharsCount.value--
                    }
                    targetCharObj.status = 'pending'
                } 
                else if (currentWordIndex.value > 0 && currentCharIndex.value === 0) {
                    currentWordIndex.value--
                    const prevWordObj = currentBatchWords.value[currentWordIndex.value]
                    currentCharIndex.value = prevWordObj.chars.length - 1
                    const targetCharObj = prevWordObj.chars[currentCharIndex.value]
                    
                    const wasPerfect = prevWordObj.chars.every(c => c.status === 'correct')
                    if (wasPerfect && perfectWordsCount.value > 0) {
                        perfectWordsCount.value--
                    }

                    if (targetCharObj.status === 'correct' && correctCharsCount.value > 0) {
                        correctCharsCount.value--
                    }
                    targetCharObj.status = 'pending'
                    if (totalCompletedWords.value > 0) totalCompletedWords.value--
                }

                nextTick(() => {
                    if (currentInput.value.length > 0) {
                        currentInput.value = currentInput.value.slice(0, -1)
                    }
                })
            }
        }

        const startTimer = () => {
            timer = setInterval(() => {
                if (timeLeft.value > 0) {
                    timeLeft.value--
                } else {
                    endTest()
                }
            }, 1000)
        }

        const endTest = () => {
            clearInterval(timer)
            isFinished.value = true
            saveToLeaderboard()
        }

        const resetTest = () => {
            initText()
            nextTick(() => {
                focusInput()
            })
        }

        const timeSpentMinutes = computed(() => {
            const elapsed = timeLimit.value - timeLeft.value
            return elapsed > 0 ? elapsed / 60 : 0.01
        })

        const wpm = computed(() => {
            if (timeSpentMinutes.value <= 0) return 0
            return Math.round((correctCharsCount.value / 5) / timeSpentMinutes.value)
        })

        const liveWpm = computed(() => wpm.value)

        const accuracy = computed(() => {
            if (totalTypedChars.value === 0) return 100
            const acc = (correctCharsCount.value / totalTypedChars.value) * 100
            return Math.max(0, Math.min(100, Math.round(acc)))
        })

        const sortedLeaderboard = computed(() => {
            return [...leaderboard.value].sort((a, b) => {
                if (b.perfectWords !== a.perfectWords) {
                    return b.perfectWords - a.perfectWords
                }
                return b.wpm - a.wpm
            })
        })

        const saveToLeaderboard = () => {
            if (wpm.value <= 0 && perfectWordsCount.value <= 0) return
            const newRecord = {
                lang: lang.value.toUpperCase(),
                time: timeLimit.value,
                wpm: wpm.value,
                perfectWords: perfectWordsCount.value,
                accuracy: accuracy.value,
                date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            leaderboard.value.unshift(newRecord)
            if (leaderboard.value.length > 10) leaderboard.value.pop()
            sessionStorage.setItem('typing_kilat_scores', JSON.stringify(leaderboard.value))
        }

        const clearLeaderboard = () => {
            leaderboard.value = []
            sessionStorage.removeItem('typing_kilat_scores')
        }

        onMounted(() => {
            initText()
            const saved = sessionStorage.getItem('typing_kilat_scores')
            if (saved) {
                try { leaderboard.value = JSON.parse(saved) } catch(e){}
            }
            nextTick(() => {
                focusInput()
            })
        })

        return {
            lang, timeLimit, soundEnabled, totalWordsTarget, totalCompletedWords, perfectWordsCount,
            isStarted, isFinished, timeLeft, currentInput, typingInput,
            currentBatchWords, currentWordIndex,
            leaderboard, sortedLeaderboard, wpm, liveWpm, accuracy,
            setLanguage, setTimeLimit, focusInput, isCurrentChar,
            handleInput, handleKeyDown, resetTest, saveScore: saveToLeaderboard, clearLeaderboard
        }
    }
}).mount('#app')