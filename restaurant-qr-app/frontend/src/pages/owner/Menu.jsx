import { useEffect, useState, useCallback } from 'react';
import { menuApi } from '../../api';

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [catName, setCatName] = useState('');
  const [form, setForm] = useState({
    category_id: '',
    name: '',
    description: '',
    price: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await menuApi.get();
      setCategories(data.categories);
      setItems(data.items);
      if (!form.category_id && data.categories[0]) {
        setForm((f) => ({ ...f, category_id: String(data.categories[0].id) }));
      }
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [form.category_id]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCat = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await menuApi.addCategory({ name: catName.trim() });
      setCatName('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    try {
      await menuApi.addItem({
        category_id: Number(form.category_id),
        name: form.name,
        description: form.description,
        price: Number(form.price),
      });
      setForm((f) => ({ ...f, name: '', description: '', price: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleAvail = async (item) => {
    try {
      await menuApi.updateItem(item.id, { is_available: !item.is_available });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const delItem = async (id) => {
    if (!confirm('Delete item?')) return;
    try {
      await menuApi.deleteItem(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const delCat = async (id) => {
    if (!confirm('Delete category and its items?')) return;
    try {
      await menuApi.deleteCategory(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Menu</h1>
          <p className="muted">Categories and items guests see after scanning QR</p>
        </div>
      </header>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="two-col">
        <section className="panel">
          <h2>Add category</h2>
          <form className="row gap" onSubmit={addCat}>
            <input
              placeholder="e.g. Starters"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
            <button className="btn btn-secondary">Add</button>
          </form>
          <ul className="simple-list mt">
            {categories.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => delCat(c.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Add item</h2>
          <form className="stack" onSubmit={addItem}>
            <label>
              Category
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>
              Description
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label>
              Price (₹)
              <input
                type="number"
                min="1"
                step="1"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </label>
            <button className="btn btn-primary">Add item</button>
          </form>
        </section>
      </div>

      <section className="mt">
        {categories.map((c) => (
          <div key={c.id} className="menu-block">
            <h2 className="section-title">{c.name}</h2>
            <div className="cards-grid">
              {items
                .filter((i) => i.category_id === c.id)
                .map((item) => (
                  <article key={item.id} className={`menu-admin-card ${!item.is_available ? 'dim' : ''}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted small">{item.description}</p>
                      <div className="price">₹{item.price}</div>
                    </div>
                    <div className="row gap wrap">
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleAvail(item)}>
                        {item.is_available ? 'Mark unavailable' : 'Mark available'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => delItem(item.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
