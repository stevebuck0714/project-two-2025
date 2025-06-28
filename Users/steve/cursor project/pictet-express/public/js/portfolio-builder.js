document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabs = document.querySelectorAll('.builder-tab');
    const sections = document.querySelectorAll('.builder-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute('href').substring(1);
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show target section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Strategy selection functionality
    const strategyCheckboxes = document.querySelectorAll('.strategy-checkbox');
    const selectedCountElement = document.getElementById('selected-count');
    
    function updateSelectedCount() {
        const selectedCount = document.querySelectorAll('.strategy-checkbox:checked').length;
        selectedCountElement.textContent = selectedCount;
        
        // Visual feedback for recommended range
        if (selectedCount >= 2 && selectedCount <= 4) {
            selectedCountElement.style.color = '#28a745';
        } else {
            selectedCountElement.style.color = '#666';
        }
    }

    strategyCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const strategyOption = this.closest('.strategy-option');
            
            // Update visual state
            if (this.checked) {
                strategyOption.setAttribute('data-selected', 'true');
            } else {
                strategyOption.removeAttribute('data-selected');
            }
            
            updateSelectedCount();
        });
    });

    // Initialize selected count
    updateSelectedCount();

    // Function to show selected fund section
    function showFundSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.fund-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from all tabs
        document.querySelectorAll('.fund-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected section
        document.getElementById('fund-' + sectionId).classList.add('active');
        
        // Add active class to clicked tab
        const clickedTab = document.querySelector(`.fund-tab[onclick="showFundSection('${sectionId}')"]`);
        if (clickedTab) {
            clickedTab.classList.add('active');
        }
    }

    // Function to format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Function to format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    }

    // Function to populate Capital Called table
    function populateCapitalCalledTable(data) {
        const tbody = document.getElementById('capital-called-data');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(row.date)}</td>
                <td>${row.type}</td>
                <td class="amount">${formatCurrency(row.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Function to populate Distributions table
    function populateDistributionsTable(data) {
        const tbody = document.getElementById('distributions-data');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(row.date)}</td>
                <td>${row.type}</td>
                <td class="amount">${formatCurrency(row.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Load cash flow data when the cash flows tab is clicked
    document.addEventListener('DOMContentLoaded', () => {
        const cashFlowsTab = document.querySelector('button[onclick="showFundSection(\'cashflows\')"]');
        if (cashFlowsTab) {
            cashFlowsTab.addEventListener('click', loadCashFlowData);
        }
    });

    function loadCashFlowData() {
        // Load Capital Called data
        fetch('/api/capital-called')
            .then(response => response.json())
            .then(data => populateCapitalCalledTable(data))
            .catch(error => console.error('Error loading Capital Called data:', error));

        // Load Distributions data
        fetch('/api/distributions')
            .then(response => response.json())
            .then(data => populateDistributionsTable(data))
            .catch(error => console.error('Error loading Distributions data:', error));
    }

    // Function to toggle Data Room sections
    function toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        const header = section.previousElementSibling;
        const icon = header.querySelector('.toggle-icon');
        
        // Toggle the section visibility
        if (section.style.display === 'none') {
            section.style.display = 'block';
            header.setAttribute('aria-expanded', 'true');
            icon.textContent = '▼';
        } else {
            section.style.display = 'none';
            header.setAttribute('aria-expanded', 'false');
            icon.textContent = '▶';
        }
    }

    // Initialize Data Room sections
    document.addEventListener('DOMContentLoaded', () => {
        // Show the first section by default, hide others
        const sections = document.querySelectorAll('.section-content');
        sections.forEach((section, index) => {
            if (index === 0) {
                section.style.display = 'block';
                section.previousElementSibling.setAttribute('aria-expanded', 'true');
            } else {
                section.style.display = 'none';
                section.previousElementSibling.setAttribute('aria-expanded', 'false');
                section.previousElementSibling.querySelector('.toggle-icon').textContent = '▶';
            }
        });
    });

    // Handle scenario input styling
    const scenarioInputs = document.querySelectorAll('.scenario-input input[type="number"]');
    
    function updateScenarioInputStyle(input) {
        const value = parseFloat(input.value);
        input.classList.remove('positive', 'negative');
        
        if (value > 0) {
            input.classList.add('positive');
        } else if (value < 0) {
            input.classList.add('negative');
        }
    }

    scenarioInputs.forEach(input => {
        // Initial styling
        updateScenarioInputStyle(input);

        // Update styling on input change
        input.addEventListener('input', function() {
            updateScenarioInputStyle(this);
        });

        // Format the input to always show one decimal place
        input.addEventListener('change', function() {
            const value = parseFloat(this.value);
            if (!isNaN(value)) {
                this.value = value.toFixed(1);
            }
        });
    });

    // Strategy selection handling
    const strategyOptions = document.querySelectorAll('.strategy-option');
    const selectedStrategies = new Set();

    // Load saved selections
    fetch('/api/get-strategies')
        .then(response => response.json())
        .then(savedSelections => {
            if (Object.keys(savedSelections).length > 0) {
                Object.entries(savedSelections).forEach(([strategyId, isSelected]) => {
                    if (isSelected) {
                        const element = document.getElementById(strategyId);
                        if (element) {
                            element.classList.add('selected');
                            selectedStrategies.add(strategyId);
                        }
                    }
                });
            }
        })
        .catch(error => console.error('Error loading saved strategies:', error));

    // Handle strategy selection
    strategyOptions.forEach(option => {
        // Add ID if not present
        if (!option.id) {
            option.id = 'strategy-' + Math.random().toString(36).substr(2, 9);
        }

        option.addEventListener('click', function() {
            this.classList.toggle('selected');
            
            if (this.classList.contains('selected')) {
                selectedStrategies.add(this.id);
            } else {
                selectedStrategies.delete(this.id);
            }

            // Save selections
            const selections = {};
            strategyOptions.forEach(opt => {
                selections[opt.id] = selectedStrategies.has(opt.id);
            });

            fetch('/api/save-strategies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ selections })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Strategies saved successfully');
                } else {
                    console.error('Error saving strategies:', data.message);
                }
            })
            .catch(error => console.error('Error saving strategies:', error));
        });
    });

    // Improved persistence for all input, select, and textarea values across the site
    function persistFormFields() {
        document.querySelectorAll('input, select, textarea').forEach(function(field) {
            var key = 'persisted_' + (field.name || '') + '_' + (field.id || '');
            var saved = localStorage.getItem(key);
            if (saved !== null) {
                if (field.type === 'checkbox' || field.type === 'radio') {
                    field.checked = saved === 'true';
                } else {
                    field.value = saved;
                }
            }
            // Save on input/change
            var saveHandler = function() {
                if (field.type === 'checkbox' || field.type === 'radio') {
                    localStorage.setItem(key, field.checked);
                } else {
                    localStorage.setItem(key, field.value);
                }
            };
            field.addEventListener('input', saveHandler);
            field.addEventListener('change', saveHandler);
        });
    }

    document.addEventListener('DOMContentLoaded', persistFormFields);
}); 