// Minister Consultation System
// Add this to profile.html and profile_other_user.html

class MinisterConsultationSystem {
  constructor() {
    this.alerts = [];
    this.currentConsultation = null;
  }

  // Generate alerts based on user data
  generateAlerts(userData) {
    const alerts = [];
    
    // Check for underperforming units
    userData.units.forEach(unit => {
      if (unit.revenue && unit.potential && unit.revenue < unit.potential * 0.7) {
        const minister = this.getMinisterForSpace(unit.space);
        alerts.push({
          type: 'underperforming',
          priority: 'high',
          minister: minister,
          unit: unit,
          message: `${unit.id} is earning ${unit.revenue} MINA but could earn ${unit.potential} MINA`,
          suggestions: [
            `Why is ${unit.id} earning less?`,
            `How can I improve ${unit.id}?`,
            `Should I sell ${unit.id}?`
          ]
        });
      }
    });
    
    // Check for loan eligibility
    userData.spaces.forEach(space => {
      const minister = this.getMinisterForSpace(space.code);
      if (this.canGetLoan(userData, space)) {
        alerts.push({
          type: 'loan_available',
          priority: 'medium',
          minister: minister,
          space: space,
          message: `Loan pre-approved: ${space.loanAmount} MINA available`,
          suggestions: [
            'What are the loan terms?',
            'How much can I borrow?',
            'What interest rate?'
          ]
        });
      }
    });
    
    // Check for forfeited units
    userData.spaces.forEach(space => {
      if (space.forfeitedUnits && space.forfeitedUnits > 0) {
        const minister = this.getMinisterForSpace(space.code);
        alerts.push({
          type: 'forfeited_units',
          priority: 'high',
          minister: minister,
          space: space,
          message: `${space.forfeitedUnits} forfeited units now available in ${space.code}`,
          suggestions: [
            'Show me available units',
            'What are the prices?',
            'Which units are best?'
          ]
        });
      }
    });
    
    // Check for development opportunities
    userData.units.forEach(unit => {
      if (!unit.development && unit.owned) {
        const minister = this.getMinisterForSpace(unit.space);
        alerts.push({
          type: 'development_opportunity',
          priority: 'medium',
          minister: minister,
          unit: unit,
          message: `Empty lot on ${unit.id} ready for development`,
          suggestions: [
            `What should I build on ${unit.id}?`,
            'What developments are profitable?',
            'Do I need financing?'
          ]
        });
      }
    });
    
    // Sort by priority
    return alerts.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Render alerts on dashboard
  renderAlerts(alerts, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="alerts-empty">
          <p>✨ No alerts right now. Your portfolio is running smoothly!</p>
        </div>
      `;
      return;
    }
    
    // Store alerts globally for onclick handlers
    window.ministerAlerts = alerts;
    
    const alertsHTML = alerts.map((alert, index) => {
      const _mpage = `minaliens/minister_${alert.minister.name.toLowerCase()}.html`;
      return `
      <div class="alert-item" data-alert-type="${alert.type}" data-alert-index="${index}">
        <a href="${_mpage}" title="View ${alert.minister.name}" style="display:block;flex-shrink:0;">
          <img src="https://play.minaliens.xyz/nfts/${alert.minister.tokenId}_${alert.minister.name.toUpperCase()}.png" 
               alt="${alert.minister.name}" 
               class="alert-minister-avatar"
               style="cursor:pointer;transition:transform .18s;"
               onmouseover="this.style.transform='scale(1.07)'"
               onmouseout="this.style.transform='scale(1)'">
        </a>
        <div class="alert-content">
          <div class="alert-minister-name">
            ${alert.minister.name} (${alert.space?.code || alert.unit?.space || 'Multiple Spaces'})
          </div>
          <div class="alert-message">
            <span class="alert-icon">${this.getAlertIcon(alert.type)}</span>
            ${alert.message}
          </div>
        </div>
        <div class="alert-actions">
          <button class="alert-btn" onclick="ministerConsultation.openConsultationByIndex(${index})">
            Get advice
          </button>
          <button class="alert-btn secondary" onclick="ministerConsultation.dismissAlert(this)">
            Ignore
          </button>
        </div>
      </div>
    `; }).join('');
    
    container.innerHTML = alertsHTML;
    
    // Update badge count
    const badge = document.getElementById('alertsCount');
    if (badge) {
      badge.textContent = `${alerts.length} new`;
    }
  }

  // Get alert icon
  getAlertIcon(type) {
    const icons = {
      underperforming: '⚠️',
      loan_available: '💰',
      forfeited_units: '🏘️',
      development_opportunity: '🏗️',
      event: '⭐'
    };
    return icons[type] || '💬';
  }

  // Get minister for space
  getMinisterForSpace(spaceCode) {
    const ministers = {
      'LUM-01': { name: 'Talha', tokenId: '1' },
      'LUM-02': { name: 'Faze', tokenId: '2' },
      'LUM-03': { name: 'Luma', tokenId: '8' },
      'LUM-04': { name: 'Nova', tokenId: '13' },
      'LUM-05': { name: 'Wisp', tokenId: '38' },
      'LUM-06': { name: 'Halo', tokenId: '47' },
      'LUM-07': { name: 'Gaze', tokenId: '84' },
      'LUM-08': { name: 'Blip', tokenId: '16' },
      'LUM-09': { name: 'Drip', tokenId: '3' },
      'LUM-10': { name: 'Opal', tokenId: '42' },
      'LUM-11': { name: 'Frog', tokenId: '25' },
      'LUM-12': { name: 'Quip', tokenId: '18' },
      'LUM-13': { name: 'Vale', tokenId: '69' },
      'LUM-14': { name: 'Angel', tokenId: '60' },
      'LUM-15': { name: 'Wise', tokenId: '59' },
      'LUM-16': { name: 'Yasin', tokenId: '82' },
      'LUM-17': { name: 'Ali', tokenId: '61' },
      'LUM-18': { name: 'Mino', tokenId: '19' },
      'LUM-19': { name: 'Zoro', tokenId: '17' },
      'LUM-20': { name: 'Sike', tokenId: '37' }
    };
    return ministers[spaceCode] || { name: 'Minister', tokenId: '1' };
  }

  // Check loan eligibility
  canGetLoan(userData, space) {
    // Simple check - in production, this would be more complex
    return userData.reliability >= 40 && !userData.defaultedLoans;
  }

  // Open consultation by alert index
  openConsultationByIndex(index) {
    const alert = window.ministerAlerts?.[index];
    if (!alert) {
      console.error('Alert not found at index', index);
      return;
    }
    
    const initialQuestion = alert.suggestions?.[0] || '';
    this.openConsultation(alert.minister.name, initialQuestion, alert);
  }

  // Open consultation modal
  openConsultation(ministerName, initialQuestion = '', alertData = null) {
    this.currentConsultation = {
      minister: ministerName,
      alertData: alertData,
      conversation: []
    };
    
    // Get minister from alert data or search all spaces
    let minister = alertData?.minister;
    
    if (!minister) {
      // Search all spaces for this minister name
      const allSpaces = ['LUM-01', 'LUM-02', 'LUM-03', 'LUM-04', 'LUM-05', 'LUM-06', 'LUM-07', 'LUM-08', 'LUM-09', 'LUM-10', 'LUM-11', 'LUM-12', 'LUM-13', 'LUM-14', 'LUM-15', 'LUM-16', 'LUM-17', 'LUM-18', 'LUM-19', 'LUM-20'];
      for (const spaceCode of allSpaces) {
        const m = this.getMinisterForSpace(spaceCode);
        if (m.name === ministerName) {
          minister = m;
          break;
        }
      }
      if (!minister) {
        minister = { name: ministerName, tokenId: '1' }; // Fallback
      }
    }
    
    const suggestions = alertData?.suggestions || this.getDefaultSuggestions(ministerName);
    
    const modalHTML = `
      <div class="consultation-modal" id="consultationModal">
        <div class="consultation-content">
          <div class="consultation-header">
            <div class="consultation-minister-info">
              <img src="https://play.minaliens.xyz/nfts/${minister.tokenId}_${ministerName.toUpperCase()}.png" 
                   alt="${ministerName}" 
                   class="consultation-minister-avatar">
              <div class="consultation-minister-details">
                <h3>Consult ${ministerName}</h3>
                <p>Minister of ${alertData?.space?.code || alertData?.unit?.space || 'Luminaea'}</p>
              </div>
            </div>
            <button class="consultation-close" onclick="ministerConsultation.closeConsultation()">×</button>
          </div>
          
          <div class="consultation-body">
            <div class="conversation-history" id="conversationHistory"></div>
            
            <div class="consultation-input-area">
              <textarea 
                class="consultation-input" 
                id="consultationInput"
                placeholder="Ask ${ministerName} about your units, loans, or strategy..."
                rows="3">${initialQuestion}</textarea>
              
              <div class="suggestion-chips-wrapper">
                <div class="suggestion-chips-label">Suggested Questions:</div>
                <div class="suggestion-chips" id="suggestionChips">
                  ${suggestions.map(s => `
                    <div class="suggestion-chip ${alertData?.priority === 'high' ? 'priority-high' : ''}" 
                         onclick="ministerConsultation.selectSuggestion('${s}')">
                      <span class="chip-icon">${this.getAlertIcon(alertData?.type || 'default')}</span>
                      <span>${s}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
              
              <button class="consultation-submit" onclick="ministerConsultation.submitQuestion()">
                Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Get default suggestions
  getDefaultSuggestions(ministerName) {
    return [
      'How can I improve my units?',
      'What loans are available?',
      'What should I develop next?',
      'Show me market opportunities'
    ];
  }

  // Select suggestion
  selectSuggestion(text) {
    document.getElementById('consultationInput').value = text;
  }

  // Submit question
  async submitQuestion() {
    const input = document.getElementById('consultationInput');
    const question = input.value.trim();
    
    if (!question) return;
    
    // Add user message to conversation
    this.addMessage('user', question);
    
    // Clear input
    input.value = '';
    
    // Simulate minister response (in production, call Claude API)
    const response = await this.getMinisterResponse(question);
    this.addMessage('minister', response);
  }

  // Add message to conversation
  addMessage(sender, text) {
    const history = document.getElementById('conversationHistory');
    const messageHTML = `
      <div class="message ${sender}">
        <div class="message-sender">${sender === 'user' ? 'You' : this.currentConsultation.minister}</div>
        <div class="message-bubble">${text}</div>
      </div>
    `;
    history.insertAdjacentHTML('beforeend', messageHTML);
    history.scrollTop = history.scrollHeight;
  }

  // Get minister response (placeholder - integrate with Claude API)
  async getMinisterResponse(question) {
    // TODO: Integrate with Claude API with minister personality
    return "I'm analyzing your question. (In production, this will be powered by Claude with my unique personality and your portfolio data.)";
  }

  // Close consultation
  closeConsultation() {
    const modal = document.getElementById('consultationModal');
    if (modal) {
      modal.remove();
    }
    this.currentConsultation = null;
  }

  // Dismiss alert
  dismissAlert(button) {
    const alertItem = button.closest('.alert-item');
    if (alertItem) {
      alertItem.style.opacity = '0';
      setTimeout(() => alertItem.remove(), 300);
    }
  }

  // Render unit card with Ask Minister button
  renderUnitCard(unit, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const isUnderperforming = unit.revenue < unit.potential * 0.7;
    const minister = this.getMinisterForSpace(unit.space);
    
    const cardHTML = `
      <div class="unit-card">
        <div class="unit-card-header">
          <div>
            <div class="unit-card-title">${unit.id} - ${unit.type || 'Unit'}</div>
            <div class="unit-card-subtitle">${unit.space}</div>
          </div>
          <div class="unit-status-badge ${isUnderperforming ? 'warning' : ''}">
            ${isUnderperforming ? '⚠️ Underperforming' : '✓ Active'}
          </div>
        </div>
        
        ${isUnderperforming ? `
          <div class="performance-indicator">
            <span class="performance-indicator-icon">📉</span>
            <div class="performance-indicator-text">
              Earning <span class="performance-percentage">${Math.round((unit.revenue / unit.potential) * 100)}%</span> of potential
            </div>
          </div>
        ` : ''}
        
        <div class="unit-stats">
          <div class="unit-stat">
            <div class="unit-stat-label">Revenue</div>
            <div class="unit-stat-value ${isUnderperforming ? 'low' : ''}">${unit.revenue} MINA</div>
            ${unit.potential ? `
              <div class="unit-stat-comparison">
                Potential: <span class="potential">${unit.potential} MINA</span>
              </div>
            ` : ''}
          </div>
          
          <div class="unit-stat">
            <div class="unit-stat-label">Value</div>
            <div class="unit-stat-value">${unit.value || 'N/A'}</div>
          </div>
        </div>
        
        <button class="ask-minister-btn" onclick="ministerConsultation.openConsultation('${minister.name}', 'Why is ${unit.id} ${isUnderperforming ? 'underperforming' : 'performing well'}?', ${JSON.stringify({ unit, type: 'unit_question', minister })})">
          <span class="ask-minister-btn-icon">💬</span>
          <div class="ask-minister-btn-text">
            <div class="ask-minister-btn-label">Ask ${minister.name}</div>
            <div class="ask-minister-btn-question">
              ${isUnderperforming ? '"Why so low?"' : '"How to optimize?"'}
            </div>
          </div>
        </button>
      </div>
    `;
    
    container.innerHTML = cardHTML;
  }
}

// Initialize global instance
const ministerConsultation = new MinisterConsultationSystem();

// Example usage - call this when profile page loads
function initializeMinisterSystem() {
  // Example user data (replace with actual data from Supabase)
  const userData = {
    units: [
      { 
        id: 'LUM-01-C', 
        space: 'LUM-01', 
        type: 'Restaurant',
        revenue: 850, 
        potential: 1500,
        value: '12,500 MINA',
        owned: true,
        development: true
      },
      {
        id: 'LUM-02-A',
        space: 'LUM-02',
        type: 'Empty Lot',
        owned: true,
        development: false
      }
    ],
    spaces: [
      { code: 'LUM-01', loanAmount: 5000, forfeitedUnits: 0 },
      { code: 'LUM-09', loanAmount: 3000, forfeitedUnits: 3 }
    ],
    reliability: 75,
    defaultedLoans: false
  };
  
  // Generate and render alerts
  const alerts = ministerConsultation.generateAlerts(userData);
  ministerConsultation.renderAlerts(alerts, 'ministerAlerts');
  
  // Optional: Render example unit card
  // ministerConsultation.renderUnitCard(userData.units[0], 'exampleUnitCard');
}
