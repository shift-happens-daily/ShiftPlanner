import api from './api';

export async function importRequirementsXlsx(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/imports/requirements/xlsx', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
