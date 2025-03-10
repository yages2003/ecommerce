const firebaseConfig = {
  apiKey: "AIzaSyAJSj3qnU3nX894NFUO4_hd8YGm4m6SPr4",
  authDomain: "e-commerce-868c6.firebaseapp.com",
  projectId: "e-commerce-868c6",
  storageBucket: "e-commerce-868c6.firebasestorage.app",
  messagingSenderId: "584459377786",
  appId: "1:584459377786:web:23b1d843611d4ae622afc3",
  measurementId: "G-JQ7JM5QL6K"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(user => {
  if (!user) window.location.href = 'index.html';
});

document.getElementById('addProductForm').addEventListener('submit', e => {
  e.preventDefault();
  const productData = {
    name: document.getElementById('productName').value,
    price: parseFloat(document.getElementById('productPrice').value),
    discountPrice: document.getElementById('productDiscountPrice').value ? parseFloat(document.getElementById('productDiscountPrice').value) : null,
    brand: document.getElementById('productBrand').value,
    category: document.getElementById('productCategory').value,
    availability: parseInt(document.getElementById('productAvailability').value),
    currency: document.getElementById('productCurrency').value,
    imageURLs: document.getElementById('productImageURLs').value.split(',').map(url => url.trim()).filter(url => url),
    isActive: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('products').add(productData)
    .then(() => {
      document.getElementById('addProductMessage').innerText = "Product added successfully!";
      document.getElementById('addProductForm').reset();
      loadProducts();
      loadAnalytics();
    })
    .catch(err => document.getElementById('addProductMessage').innerText = err.message);
});

function loadProducts() {
  const productListDiv = document.getElementById('productList');
  productListDiv.innerHTML = "Loading products...";
  db.collection('products').get()
    .then(snapshot => {
      productListDiv.innerHTML = "";
      snapshot.forEach(doc => {
        const prod = { id: doc.id, ...doc.data() };
        const imageUrl = prod.imageURLs && prod.imageURLs.length > 0 ? prod.imageURLs[0] : 'assets/images/nothing.png';
        const prodDiv = document.createElement('div');
        prodDiv.classList.add('product-card');
        const priceSymbol = prod.currency === 'INR' ? '₹' : '$';
        prodDiv.innerHTML = `
          <div class="product-image" style="background-image: url('${imageUrl}');" onerror="this.style.backgroundImage='url(assets/images/nothing.png)'"></div>
          <div class="product-info">
            <h3 class="product-name">${prod.name}</h3>
            <p>Brand: ${prod.brand}</p>
            <p>Price: ${priceSymbol}${prod.price}</p>
            ${prod.discountPrice ? `<p>Discount: ${priceSymbol}${prod.discountPrice}</p>` : ''}
            <p>Category: ${prod.category}</p>
            <p>Availability: ${prod.availability}</p>
            <button onclick="toggleProductStatus('${prod.id}', ${prod.isActive})">${prod.isActive ? 'Deactivate' : 'Activate'}</button>
            <button onclick="deleteProduct('${prod.id}')">Delete</button>
          </div>
        `;
        productListDiv.appendChild(prodDiv);
      });
    });
}

function toggleProductStatus(productId, isActive) {
  db.collection('products').doc(productId).update({
    isActive: !isActive
  }).then(() => {
    loadProducts();
    loadAnalytics();
  });
}

function deleteProduct(productId) {
  if (confirm("Are you sure you want to delete this product?")) {
    db.collection('products').doc(productId).delete()
      .then(() => {
        loadProducts();
        loadAnalytics();
      });
  }
}

function loadOrders() {
  const orderListDiv = document.getElementById('orderList');
  orderListDiv.innerHTML = "Loading orders...";
  db.collection('orders').get()
    .then(snapshot => {
      orderListDiv.innerHTML = "";
      snapshot.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        const orderDiv = document.createElement('div');
        orderDiv.classList.add('product-card');
        const orderDate = order.orderDate.toDate().toLocaleString();
        let itemsHtml = order.items.map(item => `
          <p>${item.name} x${item.quantity}</p>
          <p>Price: ${item.currency === 'INR' ? '₹' : '$'}${item.price}</p>
        `).join('');
        orderDiv.innerHTML = `
          <div class="product-info">
            <h3 class="product-name">Order ${order.id} - ${orderDate}</h3>
            ${itemsHtml}
            <p>Total: $${order.totalAmountUSD.toFixed(2)}</p>
            <p>Status: ${order.status}</p>
            <select onchange="updateOrderStatus('${order.id}', this.value)">
              <option value="ordered" ${order.status === 'ordered' ? 'selected' : ''}>Ordered</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
              <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
            </select>
          </div>
        `;
        orderListDiv.appendChild(orderDiv);
      });
    });
}

function updateOrderStatus(orderId, status) {
  db.collection('orders').doc(orderId).update({ status })
    .then(() => loadOrders());
}

function loadAnalytics() {
  db.collection('orders').get().then(orderSnapshot => {
    const productSales = {};
    const categorySales = {};

    orderSnapshot.forEach(doc => {
      const order = doc.data();
      order.items.forEach(item => {
        productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
        const prodRef = db.collection('products').doc(item.productId);
        prodRef.get().then(prodDoc => {
          if (prodDoc.exists) {
            const category = prodDoc.data().category;
            categorySales[category] = (categorySales[category] || 0) + item.quantity;
          }
        });
      });
    });

    // Bar Chart: Product Sales
    const barCtx = document.getElementById('salesBarChart').getContext('2d');
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(productSales),
        datasets: [{
          label: 'Units Sold',
          data: Object.values(productSales),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        scales: { y: { beginAtZero: true } }
      }
    });

    // Pie Chart: Category Distribution
    setTimeout(() => { // Wait for category data to populate
      const pieCtx = document.getElementById('categoryPieChart').getContext('2d');
      new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: Object.keys(categorySales),
          datasets: [{
            data: Object.values(categorySales),
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
          }]
        },
        options: { responsive: false }
      });
    }, 1000);

    // Comparison Chart: Monthly Sales (example data)
    const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
    new Chart(comparisonCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: '2024 Sales',
          data: [50, 60, 70, 80, 90, 100],
          borderColor: '#FF6384',
          fill: false
        }, {
          label: '2025 Sales',
          data: [60, 70, 80, 90, 100, 110],
          borderColor: '#36A2EB',
          fill: false
        }]
      },
      options: { responsive: false }
    });

    // Top 10 Selling Products (Table Format)
    const topProductsDiv = document.getElementById('topProducts');
    topProductsDiv.innerHTML = "<h4>Top 10 Selling Products</h4>";
    const topTable = document.createElement('table');
    topTable.classList.add('analytics-table');
    topTable.innerHTML = `
      <thead>
        <tr>
          <th>S.No</th>
          <th>Product Name</th>
          <th>Units Sold</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;
    const topTbody = topTable.querySelector('tbody');
    const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 10);
    sortedProducts.forEach(([prodId, qty], index) => {
      db.collection('products').doc(prodId).get().then(doc => {
        if (doc.exists) {
          const prod = doc.data();
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${prod.name}</td>
            <td>${qty}</td>
          `;
          topTbody.appendChild(row);
        }
      });
    });
    topProductsDiv.appendChild(topTable);

    // Bottom 10 Selling Products (Table Format)
    const bottomProductsDiv = document.getElementById('bottomProducts');
    bottomProductsDiv.innerHTML = "<h4>Bottom 10 Selling Products</h4>";
    const bottomTable = document.createElement('table');
    bottomTable.classList.add('analytics-table');
    bottomTable.innerHTML = `
      <thead>
        <tr>
          <th>S.No</th>
          <th>Product Name</th>
          <th>Units Sold</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;
    const bottomTbody = bottomTable.querySelector('tbody');
    const bottomProducts = Object.entries(productSales).sort((a, b) => a[1] - b[1]).slice(0, 10);
    bottomProducts.forEach(([prodId, qty], index) => {
      db.collection('products').doc(prodId).get().then(doc => {
        if (doc.exists) {
          const prod = doc.data();
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${prod.name}</td>
            <td>${qty}</td>
          `;
          bottomTbody.appendChild(row);
        }
      });
    });
    bottomProductsDiv.appendChild(bottomTable);
  });
}

function logout() {
  auth.signOut().then(() => window.location.href = 'index.html');
}

loadProducts();
loadOrders();
loadAnalytics();