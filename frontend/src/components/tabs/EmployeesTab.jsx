// frontend/src/components/tabs/EmployeesTab.jsx
export default function EmployeesTab({ language }) {
  const texts = {
    ru: {
      title: 'Сотрудники и позиции',
      description: 'Список сотрудников и должностей появится позже'
    },
    en: {
      title: 'Employees & Positions',
      description: 'Employee list and positions will appear here later'
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