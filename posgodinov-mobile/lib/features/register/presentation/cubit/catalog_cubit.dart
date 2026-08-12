import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';

class CatalogState extends Equatable {
  const CatalogState({
    this.categories = const <CatalogCategory>[],
    this.products = const <CatalogProduct>[],
    this.selectedCategoryId,
    this.query = '',
    this.loading = true,
    this.totalProductCount = 0,
  });

  final List<CatalogCategory> categories;
  final List<CatalogProduct> products;

  /// `null` berarti tab **SEMUA**.
  final String? selectedCategoryId;

  final String query;
  final bool loading;
  final int totalProductCount;

  /// Produk setelah penyaringan pencarian.
  ///
  /// Penyaringan dilakukan di memori: katalog satu outlet berukuran ratusan
  /// baris, dan query SQL per ketukan huruf justru lebih mahal.
  List<CatalogProduct> get visibleProducts {
    if (query.trim().isEmpty) return products;
    final String q = query.toLowerCase().trim();
    return products
        .where((CatalogProduct p) => p.name.toLowerCase().contains(q))
        .toList(growable: false);
  }

  CatalogState copyWith({
    List<CatalogCategory>? categories,
    List<CatalogProduct>? products,
    String? selectedCategoryId,
    bool resetCategory = false,
    String? query,
    bool? loading,
    int? totalProductCount,
  }) =>
      CatalogState(
        categories: categories ?? this.categories,
        products: products ?? this.products,
        selectedCategoryId:
            resetCategory ? null : (selectedCategoryId ?? this.selectedCategoryId),
        query: query ?? this.query,
        loading: loading ?? this.loading,
        totalProductCount: totalProductCount ?? this.totalProductCount,
      );

  @override
  List<Object?> get props => <Object?>[
        categories,
        products,
        selectedCategoryId,
        query,
        loading,
        totalProductCount,
      ];
}

class CatalogCubit extends Cubit<CatalogState> {
  CatalogCubit(this._repository) : super(const CatalogState());

  final CatalogRepository _repository;
  StreamSubscription<List<CatalogProduct>>? _sub;

  Future<void> load() async {
    emit(state.copyWith(loading: true));

    final List<CatalogCategory> categories = await _repository.categories();
    final int total = await _repository.totalProductCount();

    emit(
      state.copyWith(
        categories: categories,
        totalProductCount: total,
        loading: false,
      ),
    );
    await _listen(state.selectedCategoryId);
  }

  Future<void> selectCategory(String? categoryId) async {
    emit(
      state.copyWith(
        selectedCategoryId: categoryId,
        resetCategory: categoryId == null,
      ),
    );
    await _listen(categoryId);
  }

  void search(String query) => emit(state.copyWith(query: query));

  Future<void> _listen(String? categoryId) async {
    await _sub?.cancel();
    _sub = _repository.watchProducts(categoryId: categoryId).listen(
      (List<CatalogProduct> items) => emit(state.copyWith(products: items)),
    );
  }

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
