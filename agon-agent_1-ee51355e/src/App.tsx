import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Utility functions
const formatNumber = (num: number): string => {
  if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return Math.floor(num).toString();
};

const playSound = (type: 'click' | 'upgrade' | 'achievement' | 'critical') => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch(type) {
    case 'click':
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    case 'critical':
      oscillator.frequency.value = 1200;
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
    case 'upgrade':
      oscillator.frequency.value = 523.25;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'achievement':
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(554.37, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.3);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.45);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.6);
      break;
  }
};

interface Particle {
  id: number;
  x: number;
  y: number;
  value: number;
  isCritical: boolean;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  requirement: number;
  type: 'clicks' | 'points' | 'upgrades';
  unlocked: boolean;
}

const initialAchievements: Achievement[] = [
  { id: 'click10', name: 'First Steps', description: 'Click 10 times', requirement: 10, type: 'clicks', unlocked: false },
  { id: 'click100', name: 'Getting Started', description: 'Click 100 times', requirement: 100, type: 'clicks', unlocked: false },
  { id: 'click1000', name: 'Dedicated Clicker', description: 'Click 1,000 times', requirement: 1000, type: 'clicks', unlocked: false },
  { id: 'click10000', name: 'Click Master', description: 'Click 10,000 times', requirement: 10000, type: 'clicks', unlocked: false },
  { id: 'points1000', name: 'Thousand Club', description: 'Earn 1,000 points', requirement: 1000, type: 'points', unlocked: false },
  { id: 'points1m', name: 'Millionaire', description: 'Earn 1,000,000 points', requirement: 1000000, type: 'points', unlocked: false },
  { id: 'points1b', name: 'Billionaire', description: 'Earn 1,000,000,000 points', requirement: 1000000000, type: 'points', unlocked: false },
  { id: 'upgrades5', name: 'Upgrader', description: 'Buy 5 upgrades', requirement: 5, type: 'upgrades', unlocked: false },
  { id: 'upgrades25', name: 'Power Player', description: 'Buy 25 upgrades', requirement: 25, type: 'upgrades', unlocked: false },
  { id: 'upgrades100', name: 'Upgrade Addict', description: 'Buy 100 upgrades', requirement: 100, type: 'upgrades', unlocked: false },
];

export default function App() {
  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [autoIncome, setAutoIncome] = useState(0);
  const [critChance, setCritChance] = useState(0);
  const [critMultiplier] = useState(5);
  
  const [clickPowerLevel, setClickPowerLevel] = useState(0);
  const [autoIncomeLevel, setAutoIncomeLevel] = useState(0);
  const [critChanceLevel, setCritChanceLevel] = useState(0);
  
  const [totalClicks, setTotalClicks] = useState(0);
  const [totalUpgrades, setTotalUpgrades] = useState(0);
  
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isBoostActive, setIsBoostActive] = useState(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState(0);
  
  const [dailyRewardAvailable, setDailyRewardAvailable] = useState(true);
  const [lastDailyReward, setLastDailyReward] = useState<number | null>(null);
  const [dailyStreak, setDailyStreak] = useState(1);
  
  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements);
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);
  const [activeTab, setActiveTab] = useState<'upgrades' | 'achievements'>('upgrades');
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const particleIdRef = useRef(0);
  const crystalRef = useRef<HTMLDivElement>(null);

  // Calculate costs
  const clickPowerCost = Math.floor(10 * Math.pow(1.15, clickPowerLevel));
  const autoIncomeCost = Math.floor(50 * Math.pow(1.18, autoIncomeLevel));
  const critChanceCost = Math.floor(200 * Math.pow(1.25, critChanceLevel));

  // Progress to next upgrade
  const getProgress = (cost: number) => Math.min((points / cost) * 100, 100);

  // Load game state
  useEffect(() => {
    const saved = localStorage.getItem('crystalClickerSave');
    if (saved) {
      const data = JSON.parse(saved);
      setPoints(data.points || 0);
      setTotalEarned(data.totalEarned || 0);
      setClickPower(data.clickPower || 1);
      setAutoIncome(data.autoIncome || 0);
      setCritChance(data.critChance || 0);
      setClickPowerLevel(data.clickPowerLevel || 0);
      setAutoIncomeLevel(data.autoIncomeLevel || 0);
      setCritChanceLevel(data.critChanceLevel || 0);
      setTotalClicks(data.totalClicks || 0);
      setTotalUpgrades(data.totalUpgrades || 0);
      setDailyStreak(data.dailyStreak || 1);
      if (data.achievements) setAchievements(data.achievements);
      if (data.lastDailyReward) {
        const lastReward = new Date(data.lastDailyReward);
        const now = new Date();
        const hoursSince = (now.getTime() - lastReward.getTime()) / (1000 * 60 * 60);
        setLastDailyReward(data.lastDailyReward);
        setDailyRewardAvailable(hoursSince >= 24);
      }
    }
  }, []);

  // Save game state
  useEffect(() => {
    const saveData = {
      points, totalEarned, clickPower, autoIncome, critChance,
      clickPowerLevel, autoIncomeLevel, critChanceLevel,
      totalClicks, totalUpgrades, achievements, lastDailyReward, dailyStreak
    };
    localStorage.setItem('crystalClickerSave', JSON.stringify(saveData));
  }, [points, totalEarned, clickPower, autoIncome, critChance, clickPowerLevel, autoIncomeLevel, critChanceLevel, totalClicks, totalUpgrades, achievements, lastDailyReward, dailyStreak]);

  // Auto income tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (autoIncome > 0) {
        const income = isBoostActive ? autoIncome * 2 : autoIncome;
        setPoints(p => p + income / 10);
        setTotalEarned(t => t + income / 10);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [autoIncome, isBoostActive]);

  // Boost timer
  useEffect(() => {
    if (isBoostActive && boostTimeLeft > 0) {
      const timer = setTimeout(() => setBoostTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (boostTimeLeft <= 0) {
      setIsBoostActive(false);
    }
  }, [isBoostActive, boostTimeLeft]);

  // Check achievements
  useEffect(() => {
    setAchievements(prev => {
      let newAchievement: Achievement | null = null;
      const updated = prev.map(ach => {
        if (ach.unlocked) return ach;
        let unlocked = false;
        if (ach.type === 'clicks' && totalClicks >= ach.requirement) unlocked = true;
        if (ach.type === 'points' && totalEarned >= ach.requirement) unlocked = true;
        if (ach.type === 'upgrades' && totalUpgrades >= ach.requirement) unlocked = true;
        if (unlocked && !ach.unlocked) {
          newAchievement = { ...ach, unlocked: true };
          return newAchievement;
        }
        return ach;
      });
      if (newAchievement) {
        setShowAchievement(newAchievement);
        if (soundEnabled) playSound('achievement');
        setTimeout(() => setShowAchievement(null), 3000);
      }
      return updated;
    });
  }, [totalClicks, totalEarned, totalUpgrades, soundEnabled]);

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const isCritical = Math.random() * 100 < critChance;
    let earnedPoints = clickPower * (isCritical ? critMultiplier : 1) * (isBoostActive ? 2 : 1);
    
    setPoints(p => p + earnedPoints);
    setTotalEarned(t => t + earnedPoints);
    setTotalClicks(c => c + 1);
    
    if (soundEnabled) playSound(isCritical ? 'critical' : 'click');
    
    // Create particle
    const rect = crystalRef.current?.getBoundingClientRect();
    if (rect) {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const newParticle: Particle = {
        id: particleIdRef.current++,
        x: clientX - rect.left,
        y: clientY - rect.top,
        value: earnedPoints,
        isCritical
      };
      setParticles(p => [...p, newParticle]);
      setTimeout(() => {
        setParticles(p => p.filter(particle => particle.id !== newParticle.id));
      }, 1000);
    }
  }, [clickPower, critChance, critMultiplier, isBoostActive, soundEnabled]);

  const buyClickPower = () => {
    if (points >= clickPowerCost) {
      setPoints(p => p - clickPowerCost);
      setClickPower(cp => cp + 1 + Math.floor(clickPowerLevel / 5));
      setClickPowerLevel(l => l + 1);
      setTotalUpgrades(u => u + 1);
      if (soundEnabled) playSound('upgrade');
    }
  };

  const buyAutoIncome = () => {
    if (points >= autoIncomeCost) {
      setPoints(p => p - autoIncomeCost);
      setAutoIncome(ai => ai + 1 + Math.floor(autoIncomeLevel / 3));
      setAutoIncomeLevel(l => l + 1);
      setTotalUpgrades(u => u + 1);
      if (soundEnabled) playSound('upgrade');
    }
  };

  const buyCritChance = () => {
    if (points >= critChanceCost && critChance < 50) {
      setPoints(p => p - critChanceCost);
      setCritChance(cc => Math.min(cc + 2, 50));
      setCritChanceLevel(l => l + 1);
      setTotalUpgrades(u => u + 1);
      if (soundEnabled) playSound('upgrade');
    }
  };

  const watchAd = () => {
    // Simulate watching an ad
    setIsBoostActive(true);
    setBoostTimeLeft(30);
    if (soundEnabled) playSound('achievement');
  };

  const claimDailyReward = () => {
    if (dailyRewardAvailable) {
      const reward = 100 * dailyStreak * (clickPowerLevel + 1);
      setPoints(p => p + reward);
      setTotalEarned(t => t + reward);
      setDailyRewardAvailable(false);
      setLastDailyReward(Date.now());
      setDailyStreak(s => s + 1);
      if (soundEnabled) playSound('achievement');
    }
  };

  const resetGame = () => {
    localStorage.removeItem('crystalClickerSave');
    setPoints(0);
    setTotalEarned(0);
    setClickPower(1);
    setAutoIncome(0);
    setCritChance(0);
    setClickPowerLevel(0);
    setAutoIncomeLevel(0);
    setCritChanceLevel(0);
    setTotalClicks(0);
    setTotalUpgrades(0);
    setDailyStreak(1);
    setDailyRewardAvailable(true);
    setLastDailyReward(null);
    setIsBoostActive(false);
    setBoostTimeLeft(0);
    setAchievements(initialAchievements);
    setShowResetConfirm(false);
    if (soundEnabled) playSound('click');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white overflow-hidden">
      {/* Background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
            initial={{ x: Math.random() * window.innerWidth, y: window.innerHeight + 10 }}
            animate={{
              y: -10,
              x: Math.random() * window.innerWidth,
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              delay: Math.random() * 10,
            }}
          />
        ))}
      </div>

      {/* Achievement popup */}
      <AnimatePresence>
        {showAchievement && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 rounded-xl shadow-2xl shadow-amber-500/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="font-bold text-black">{showAchievement.name}</p>
                <p className="text-sm text-black/70">{showAchievement.description}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2x Boost indicator */}
      {isBoostActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 rounded-full font-bold shadow-lg shadow-green-500/30 z-40"
        >
          2X BOOST: {boostTimeLeft}s
        </motion.div>
      )}

      {/* Sound toggle */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className="fixed top-4 left-4 z-40 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      {/* Reset button */}
      <button
        onClick={() => setShowResetConfirm(true)}
        className="fixed top-16 left-4 z-40 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors"
        title="Reset Game"
      >
        🔄
      </button>

      {/* Reset confirmation modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-white/10 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-2 text-center">⚠️ Reset Game?</h2>
              <p className="text-purple-300/70 text-sm text-center mb-6">
                This will delete ALL your progress, including points, upgrades, and achievements. This cannot be undone!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={resetGame}
                  className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-colors shadow-lg shadow-red-500/20"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto px-4 py-6 relative z-10">
        {/* Score display */}
        <motion.div
          className="text-center mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <p className="text-purple-300 text-sm uppercase tracking-wider mb-1">Crystal Energy</p>
          <motion.h1
            key={Math.floor(points)}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-5xl md:text-6xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            {formatNumber(points)}
          </motion.h1>
          <p className="text-purple-400/60 text-sm mt-1">
            +{formatNumber(clickPower)}/click • +{formatNumber(autoIncome)}/sec
          </p>
        </motion.div>

        {/* Main crystal */}
        <div className="relative flex justify-center mb-8" ref={crystalRef}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            onTouchStart={handleClick}
            className="relative w-48 h-48 md:w-56 md:h-56 cursor-pointer select-none touch-none"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full blur-3xl opacity-50 animate-pulse" />
            
            {/* Crystal */}
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0],
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative w-full h-full"
            >
              <div className="absolute inset-4 bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 rounded-3xl rotate-45 shadow-2xl shadow-purple-500/50" />
              <div className="absolute inset-8 bg-gradient-to-br from-white/40 to-transparent rounded-2xl rotate-45" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl">💎</span>
              </div>
            </motion.div>
          </motion.button>

          {/* Click particles */}
          <AnimatePresence>
            {particles.map(particle => (
              <motion.div
                key={particle.id}
                initial={{ x: particle.x, y: particle.y, scale: 0.5, opacity: 1 }}
                animate={{ y: particle.y - 100, scale: particle.isCritical ? 1.5 : 1, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`absolute pointer-events-none font-bold text-lg ${
                  particle.isCritical 
                    ? 'text-yellow-400 text-2xl' 
                    : 'text-cyan-300'
                }`}
                style={{ left: 0, top: 0 }}
              >
                +{formatNumber(particle.value)}
                {particle.isCritical && ' 💥'}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={watchAd}
            disabled={isBoostActive}
            className={`p-3 rounded-xl font-semibold transition-all ${
              isBoostActive
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/20'
            }`}
          >
            📺 Watch Ad (2x)
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={claimDailyReward}
            disabled={!dailyRewardAvailable}
            className={`p-3 rounded-xl font-semibold transition-all ${
              !dailyRewardAvailable
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/20'
            }`}
          >
            🎁 Daily (Day {dailyStreak})
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('upgrades')}
            className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'upgrades'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
            }`}
          >
            ⚡ Upgrades
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'achievements'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-purple-300 hover:bg-white/10'
            }`}
          >
            🏆 Achievements
          </button>
        </div>

        {/* Content */}
        {activeTab === 'upgrades' ? (
          <div className="space-y-3">
            {/* Click Power */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="text-xl">👆</span> Click Power
                    <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded-full">Lv.{clickPowerLevel}</span>
                  </h3>
                  <p className="text-sm text-purple-300/70">+{formatNumber(clickPower)} per click</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={buyClickPower}
                  disabled={points < clickPowerCost}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    points >= clickPowerCost
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
                      : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {formatNumber(clickPowerCost)}
                </motion.button>
              </div>
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgress(clickPowerCost)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>

            {/* Auto Income */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="text-xl">⚡</span> Auto Income
                    <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded-full">Lv.{autoIncomeLevel}</span>
                  </h3>
                  <p className="text-sm text-purple-300/70">+{formatNumber(autoIncome)}/second</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={buyAutoIncome}
                  disabled={points < autoIncomeCost}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    points >= autoIncomeCost
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/20'
                      : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {formatNumber(autoIncomeCost)}
                </motion.button>
              </div>
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgress(autoIncomeCost)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>

            {/* Critical Chance */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="text-xl">💥</span> Critical Chance
                    <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded-full">Lv.{critChanceLevel}</span>
                  </h3>
                  <p className="text-sm text-purple-300/70">{critChance.toFixed(0)}% chance for {critMultiplier}x</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={buyCritChance}
                  disabled={points < critChanceCost || critChance >= 50}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    points >= critChanceCost && critChance < 50
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20'
                      : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {critChance >= 50 ? 'MAX' : formatNumber(critChanceCost)}
                </motion.button>
              </div>
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${critChance >= 50 ? 100 : getProgress(critChanceCost)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {achievements.map(ach => (
              <motion.div
                key={ach.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-xl border transition-all ${
                  ach.unlocked
                    ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/30'
                    : 'bg-white/5 border-white/10 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ach.unlocked ? '🏆' : '🔒'}</span>
                  <div>
                    <h4 className="font-bold text-sm">{ach.name}</h4>
                    <p className="text-xs text-purple-300/70">{ach.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-xs text-purple-300/60">Total Clicks</p>
            <p className="font-bold text-sm">{formatNumber(totalClicks)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-xs text-purple-300/60">Total Earned</p>
            <p className="font-bold text-sm">{formatNumber(totalEarned)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-xs text-purple-300/60">Upgrades</p>
            <p className="font-bold text-sm">{totalUpgrades}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
