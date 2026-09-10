/**
 * RailFlow Rules & Business Logic Engine
 * Flexible, pluggable rule registry for railway operating constraints.
 * Enables rapid addition and refinement of new business logic rules without altering core loops.
 */

class RulesEngine {
  constructor() {
    this.rules = new Map();
    this.registerDefaultRules();
  }

  /**
   * Register a new business logic rule
   * @param {string} id - Unique rule identifier (e.g. 'RULE-FIFO-01')
   * @param {Object} ruleDef - Rule definition object
   */
  registerRule(id, ruleDef) {
    if (!id || typeof ruleDef.evaluate !== 'function') {
      throw new Error(`Rule ${id} must provide an evaluate(context) method.`);
    }
    this.rules.set(id, {
      id: id,
      name: ruleDef.name || id,
      category: ruleDef.category || 'OPERATIONAL',
      enabled: ruleDef.enabled !== undefined ? ruleDef.enabled : true,
      description: ruleDef.description || '',
      evaluate: ruleDef.evaluate
    });
  }

  getRule(id) {
    return this.rules.get(id);
  }

  listRules() {
    return Array.from(this.rules.values()).map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      enabled: r.enabled,
      description: r.description
    }));
  }

  setRuleEnabled(id, enabled) {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = !!enabled;
    }
  }

  /**
   * Evaluates all enabled rules against the given operational context
   * @param {Object} context - { window, trains, requestedLine, blockType, activity, machinery, config }
   * @returns {Object} { passed: boolean, results: Array, flags: Array }
   */
  evaluate(context) {
    const results = [];
    const flags = [];
    let passed = true;

    for (const [id, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      try {
        const res = rule.evaluate(context);
        results.push({
          ruleId: id,
          ruleName: rule.name,
          category: rule.category,
          passed: res.passed,
          severity: res.severity || 'INFO',
          message: res.message,
          data: res.data || null
        });

        if (res.passed === false && (res.severity === 'CRITICAL' || res.severity === 'ERROR')) {
          passed = false;
        }

        if (res.flag) {
          flags.push(res.flag);
        }
      } catch (err) {
        results.push({
          ruleId: id,
          ruleName: rule.name,
          passed: false,
          severity: 'ERROR',
          message: `Rule execution error: ${err.message}`
        });
        passed = false;
      }
    }

    return {
      passed,
      results,
      flags
    };
  }

  registerDefaultRules() {
    // 1. Minimum Headway Clearance Buffer Rule
    this.registerRule('RULE-HEADWAY-01', {
      name: 'Safety Headway Clearance Bound',
      category: 'SAFETY',
      description: 'Enforces minimum safety buffer between trains and active worksite boundaries.',
      evaluate: (ctx) => {
        const headway = ctx.config?.headwayMinutes || 12;
        const buffer = Math.max(3, Math.round(headway / 2));
        return {
          passed: buffer >= 3,
          severity: buffer < 3 ? 'CRITICAL' : 'INFO',
          message: `Safety headway buffer active: ${buffer} min (Safety lower bound: 3 min).`,
          data: { bufferMin: buffer, configuredHeadway: headway }
        };
      }
    });

    // 2. Railway Board Priority Rule
    this.registerRule('RULE-BOARD-01', {
      name: 'Railway Board Priority Hierarchy',
      category: 'OPERATIONAL',
      description: 'Protects Vande Bharat, Rajdhani, and Superfast paths from maintenance disruption.',
      evaluate: (ctx) => {
        const priorityTrains = (ctx.conflictingTrains || []).filter(t => t.priority <= 2 || t.type === 'Vande Bharat');
        if (priorityTrains.length > 0) {
          return {
            passed: false,
            severity: 'CRITICAL',
            message: `Priority conflict with ${priorityTrains.length} high-precedence train(s).`,
            data: { priorityTrains }
          };
        }
        return {
          passed: true,
          severity: 'INFO',
          message: 'Zero high-priority passenger trains affected.'
        };
      }
    });

    // 3. Conditional 25kV Traction Power Block Rule
    this.registerRule('RULE-TRD-POWER-01', {
      name: 'Conditional Traction Power Block Isolation',
      category: 'ELECTRICAL',
      description: 'Requires 25kV OHE power block only if equipment or work involves overhead wires.',
      evaluate: (ctx) => {
        const act = (ctx.activityName || '').toLowerCase();
        const mach = (ctx.machinery || '').toLowerCase();
        const requiresOhe = act.includes('ohe') || act.includes('catenary') || act.includes('traction') || act.includes('isolator') || mach.includes('tower wagon');

        return {
          passed: true,
          severity: 'INFO',
          message: requiresOhe ? '25kV AC Power Block isolation permit required.' : 'Standard track possession without automatic Power Block.',
          data: { powerBlockRequired: requiresOhe }
        };
      }
    });

    // 4. Line Block and Track Consistency Rule
    this.registerRule('RULE-LINE-BLOCK-CONSISTENCY', {
      name: 'Track Line and Block Possession Consistency',
      category: 'SAFETY',
      description: 'Ensures the requested line corresponds to the appropriate block possession.',
      evaluate: (ctx) => {
        const line = ctx.trackLine;
        const block = ctx.blockType;
        let valid = false;
        if (line === 'UP Main Line' && block === 'UP Line Block') valid = true;
        else if (line === 'DOWN Main Line' && block === 'DOWN Line Block') valid = true;
        else if (line === 'Both UP & DOWN Lines' && block === 'Both Lines Block (Simultaneous)') valid = true;
        else if (line === 'Station Loop / Yard Track' && block === 'Station Loop / Yard Track Block') valid = true;

        return {
          passed: valid,
          severity: valid ? 'INFO' : 'CRITICAL',
          message: valid ? 'Line and block possession types are consistent.' : 'Line and block type mismatch.'
        };
      }
    });
  }
}

module.exports = new RulesEngine();
