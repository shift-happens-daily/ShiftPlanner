// frontend/src/components/tabs/ShiftsTab.jsx
export default function ShiftsTab({ language }) {
  const texts = {
    ru: {
      title: 'Настройки смен',
      description: 'Настройки смен появятся позже'
    },
    en: {
      title: 'Shift Settings',
      description: 'Shift settings will appear here later'
    }
  };

  const t = texts[language] || texts.ru;

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>{t.title}</h2>
      <p style={styles.description}>{t.description}</p>
    </div>
  );
}

const styles = {
  card: {
    background: '#F4FAFF',
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#002642',
    margin: '0 0 16px 0'
  },
  description: {
    fontSize: '16px',
    color: '#4F646F',
    margin: 0
  }
};