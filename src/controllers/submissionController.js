const db = require('../config/db');

exports.submitForm = async (req, res) => {
  const { form_type, name, email, company, message, ...rest } = req.body;

  if (!form_type) {
    return res.status(400).json({ success: false, error: 'Form type is required' });
  }

  try {
    const detailsJson = JSON.stringify(rest || {});
    const sql = `
      INSERT INTO submissions (form_type, name, email, company, message, details_json) 
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const params = [form_type, name || '', email || '', company || '', message || '', detailsJson];

    if (db.getDbType() === 'postgres') {
      const result = await db.run(sql + ' RETURNING id', params);
      res.status(201).json({ success: true, message: 'Submission received successfully', id: result.rows[0].id });
    } else {
      const result = await db.run(sql, params);
      res.status(201).json({ success: true, message: 'Submission received successfully', id: result.lastID });
    }
  } catch (err) {
    console.error('Error saving submission:', err);
    res.status(500).json({ success: false, error: 'Failed to process submission' });
  }
};

exports.getAllSubmissions = async (req, res) => {
  try {
    const submissions = await db.query('SELECT * FROM submissions ORDER BY created_at DESC');
    res.json({ success: true, submissions });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve submissions' });
  }
};

exports.deleteSubmission = async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM submissions WHERE id = $1', [parseInt(id)]);
    res.json({ success: true, message: 'Submission deleted successfully' });
  } catch (err) {
    console.error('Error deleting submission:', err);
    res.status(500).json({ success: false, error: 'Failed to delete submission' });
  }
};
